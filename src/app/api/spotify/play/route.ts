import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// To test: open Spotify on any device (phone, desktop, web player at open.spotify.com)
// THEN enter a track ID and click Play. The song will play on whichever device is active.

interface SpotifyDevice {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
    is_restricted: boolean;
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "unauthorized", message: "No session found." }, { status: 401 });
    }

    // If the JWT layer already flagged a refresh error, surface it immediately
    if (session.error === "RefreshAccessTokenError") {
        console.error("[play] Session has RefreshAccessTokenError — user must re-authenticate");
        return NextResponse.json(
            { error: "reauth_required", message: "Session expired. Please sign out and sign back in." },
            { status: 401 }
        );
    }

    const body = await req.json().catch(() => ({}));
    const { trackId } = body as { trackId?: string };

    if (!trackId) {
        return NextResponse.json({ error: "missing_track_id", message: "trackId is required in the request body." }, { status: 400 });
    }

    console.log("[play] trackId received:", trackId);
    console.log("[play] token prefix (first 8 chars):", session.accessToken.slice(0, 8));

    const authHeader = { Authorization: `Bearer ${session.accessToken}` };

    // ── Step 1: Fetch available devices ──────────────────────────────────────
    // Spotify's /me/player/play with no device_id requires an "active" device,
    // which is a transient server-side state — just having Spotify open is not
    // enough. By fetching devices first and passing an explicit device_id, we
    // can target any available (even non-active) device directly.
    console.log("[play] fetching available devices from Spotify...");
    const devicesRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: authHeader,
    });

    if (!devicesRes.ok) {
        const devErr = await devicesRes.json().catch(() => ({}));
        console.error("[play] failed to fetch devices:", devicesRes.status, JSON.stringify(devErr));
        return NextResponse.json(
            { error: "devices_fetch_failed", message: "Could not retrieve Spotify devices.", detail: devErr },
            { status: devicesRes.status }
        );
    }

    const { devices } = (await devicesRes.json()) as { devices: SpotifyDevice[] };
    console.log("[play] available devices:", devices.map(d => `${d.name} (${d.type}, active=${d.is_active})`));

    if (!devices || devices.length === 0) {
        return NextResponse.json(
            {
                error: "no_available_device",
                message: "No Spotify devices found at all. Open Spotify on your phone, desktop, or web player and try again.",
            },
            { status: 404 }
        );
    }

    // Prefer an already-active device; fall back to the first available one
    const target = devices.find(d => d.is_active) ?? devices[0];
    console.log(`[play] targeting device: "${target.name}" (${target.type}, id=${target.id})`);

    // ── Step 2: Send play command with explicit device_id ────────────────────
    console.log("[play] calling Spotify PUT /me/player/play");
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${target.id}`, {
        method: "PUT",
        headers: {
            ...authHeader,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            uris: [`spotify:track:${trackId}`],
        }),
    });

    console.log("[play] Spotify response status:", res.status);

    // 204 — success, playback started
    if (res.status === 204) {
        return NextResponse.json({ success: true, device: target.name });
    }

    // Read Spotify's error body for all failure cases
    const spotifyError = await res.json().catch(() => ({}));
    console.error("[play] Spotify error body:", JSON.stringify(spotifyError));

    // 404 — device disappeared between our device fetch and the play call
    if (res.status === 404) {
        return NextResponse.json(
            { error: "no_active_device", message: "No active Spotify device found. Open Spotify on any device first." },
            { status: 404 }
        );
    }

    // 403 — Premium required or insufficient scope
    if (res.status === 403) {
        return NextResponse.json(
            { error: "premium_required", message: "Spotify Premium is required for playback control." },
            { status: 403 }
        );
    }

    // 401 — Spotify's player API returns 401 both for expired tokens AND for missing
    // scopes (specifically user-modify-playback-state). If you see this after adding
    // the scope, you MUST sign out fully and sign back in — the refresh_token grant
    // does NOT retroactively add new scopes to existing sessions.
    if (res.status === 401) {
        return NextResponse.json(
            {
                error: "reauth_required",
                message: "Token missing required scope or is invalid. Sign out and sign back in to fix this.",
                detail: spotifyError,
            },
            { status: 401 }
        );
    }

    // Any other error — surface raw Spotify body for debugging
    return NextResponse.json({ error: "spotify_error", status: res.status, detail: spotifyError }, { status: res.status });
}
