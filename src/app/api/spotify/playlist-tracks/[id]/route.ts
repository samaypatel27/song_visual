import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

interface SpotifyImage {
    url: string;
    width: number;
    height: number;
}

interface SpotifyTrackObject {
    id: string;
    name: string;
    album: {
        id: string;
        name: string;
        images: SpotifyImage[];
    };
}

interface SpotifyTrackItem {
    track: SpotifyTrackObject | null;
}

interface SpotifyTracksPage {
    items: SpotifyTrackItem[];
    next: string | null;
}

export interface TrackData {
    trackId: string;
    trackName: string;
    albumId: string;
    albumName: string;
    albumCoverUrl: string;
}

// GET /api/spotify/playlist-tracks/[id]
// Root-cause fix: removed the `fields` filter parameter.
// Using encodeURIComponent() on a fields string with nested parentheses
// and `next` at root level causes Spotify's tracks endpoint to 403.
// Without `fields`, Spotify returns the full page; we pick what we need.
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    // Diagnostic log — confirms route is hit and token is present
    console.log("[playlist-tracks] route hit, id:", id);
    console.log(
        "[playlist-tracks] accessToken present:",
        !!session?.accessToken,
        "| prefix:",
        session?.accessToken?.slice(0, 12) ?? "MISSING"
    );

    if (!session?.accessToken) {
        console.log("[playlist-tracks] 401 — no access token in session");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pre-check: call /me to confirm the token is still alive.
    // If /me fails → token expired; if /me succeeds but tracks → playlist restriction.
    const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    console.log("[playlist-tracks] /me status:", meRes.status);
    if (!meRes.ok) {
        const meBody = await meRes.json().catch(() => ({}));
        console.log("[playlist-tracks] token expired or invalid:", JSON.stringify(meBody));
        return NextResponse.json(
            { error: "Token invalid or expired — please sign out and sign back in", detail: meBody },
            { status: meRes.status }
        );
    }

    const tracks: TrackData[] = [];
    // No `fields` filter — keeps it simple and avoids the 403-triggering encoding issue
    let url: string | null = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;

    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });

        // Log raw Spotify status so we can distinguish 401 vs 403 vs 200
        console.log("[playlist-tracks] Spotify status:", res.status, "url:", url.split("?")[0]);

        if (!res.ok) {
            const raw = await res.json().catch(() => ({}));
            console.log("[playlist-tracks] Spotify error body:", JSON.stringify(raw));
            return NextResponse.json(
                { error: "Spotify API error", status: res.status, detail: raw },
                { status: res.status }
            );
        }

        const page = (await res.json()) as SpotifyTracksPage;

        for (const item of page.items) {
            if (!item.track) continue;
            const t = item.track;
            tracks.push({
                trackId: t.id,
                trackName: t.name,
                albumId: t.album.id,
                albumName: t.album.name,
                albumCoverUrl: t.album.images[0]?.url ?? "",
            });
        }

        url = page.next;
    }

    console.log(`[playlist-tracks] returning ${tracks.length} tracks for playlist ${id}`);
    return NextResponse.json({ tracks });
}
