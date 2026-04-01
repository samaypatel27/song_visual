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

/**
 * Classify a fetch() network-level error (thrown before any HTTP response).
 * These are distinct from Spotify API errors (which have HTTP status codes).
 *
 * UND_ERR_CONNECT_TIMEOUT — TCP handshake to api.spotify.com:443 timed out.
 *   This is an intermittent local network issue, NOT Spotify rate-limiting.
 *   Spotify rate-limiting returns HTTP 429 with a Retry-After header.
 *
 * ECONNREFUSED / ENOTFOUND — DNS or routing failure.
 */
function classifyNetworkError(err: unknown): { error: string; message: string } {
    const e = err as any;
    const code: string = e?.cause?.code ?? e?.code ?? "";
    const name: string = e?.cause?.name ?? e?.name ?? "";

    if (code === "UND_ERR_CONNECT_TIMEOUT" || name === "ConnectTimeoutError") {
        return {
            error: "network_timeout",
            message: "Your playing songs too fast! Try again in a bit.",
        };
    }
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
        return {
            error: "network_dns",
            message: "Could not reach Spotify (DNS failure). Check your internet connection.",
        };
    }
    if (code === "ECONNREFUSED") {
        return {
            error: "network_refused",
            message: "Connection to Spotify was refused. Try again in a few seconds.",
        };
    }

    // Unknown network error
    return {
        error: "network_error",
        message: `Network error while contacting Spotify: ${e?.message ?? "unknown"}`,
    };
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

    let devicesRes: Response;
    try {
        devicesRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
            headers: authHeader,
        });
    } catch (err) {
        const classified = classifyNetworkError(err);
        console.error("[play] network error fetching devices:", classified.error, (err as any)?.cause?.code ?? (err as any)?.code);
        return NextResponse.json(classified, { status: 503 });
    }

    // Spotify 429 — real rate limiting (distinct from network timeouts)
    if (devicesRes.status === 429) {
        const retryAfter = devicesRes.headers.get("Retry-After") ?? "a few";
        console.warn(`[play] Spotify rate limit hit (devices). Retry-After: ${retryAfter}s`);
        return NextResponse.json(
            {
                error: "rate_limited",
                message: `Spotify is rate-limiting requests. Wait ${retryAfter} seconds and try again.`,
                retryAfter,
            },
            { status: 429 }
        );
    }

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

    let res: Response;
    try {
        res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${target.id}`, {
            method: "PUT",
            headers: {
                ...authHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                uris: [`spotify:track:${trackId}`],
            }),
        });
    } catch (err) {
        const classified = classifyNetworkError(err);
        console.error("[play] network error sending play command:", classified.error, (err as any)?.cause?.code ?? (err as any)?.code);
        return NextResponse.json(classified, { status: 503 });
    }

    console.log("[play] Spotify response status:", res.status);

    // 204 — success, playback started
    if (res.status === 204) {
        return NextResponse.json({ success: true, device: target.name });
    }

    // Read Spotify's error body for all failure cases
    const spotifyError = await res.json().catch(() => ({}));
    console.error("[play] Spotify error body:", JSON.stringify(spotifyError));

    // 429 — Spotify rate limit on the play endpoint
    if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") ?? "a few";
        console.warn(`[play] Spotify rate limit hit (play). Retry-After: ${retryAfter}s`);
        return NextResponse.json(
            {
                error: "rate_limited",
                message: `You're changing tracks too fast. Wait ${retryAfter} seconds before playing another song.`,
                retryAfter,
            },
            { status: 429 }
        );
    }

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
