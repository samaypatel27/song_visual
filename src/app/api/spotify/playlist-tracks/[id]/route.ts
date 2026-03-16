import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

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

// February 2026 Spotify API change:
//   - Old field: items[].track  (now deprecated, kept here as fallback)
//   - New field: items[].item   (use this)
// See: spotifyapi.md — "[RENAMED] tracks.tracks.track -> items.items.item"
interface SpotifyPlaylistItem {
    item: SpotifyTrackObject | null; // new field (Feb 2026)
    track: SpotifyTrackObject | null; // deprecated — fallback only
}

interface SpotifyItemsPage {
    items: SpotifyPlaylistItem[];
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
//
// February 2026 API migration (source: spotifyapi.md):
//   BEFORE: GET /playlists/{id}/tracks  (limit max: 100)  [REMOVED]
//   AFTER:  GET /playlists/{id}/items   (limit max: 50)   [current]
//
// Response field rename:
//   BEFORE: page.items[].track
//   AFTER:  page.items[].item  (track is now deprecated)
//
// Access restriction (from spotifyapi.md line 6):
//   "Only accessible for playlists owned by the current user or
//    playlists the user is a collaborator of."
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

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

    // Pre-check: confirm token is alive before calling the playlist endpoint
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

    // ── Updated endpoint (Feb 2026): /items instead of /tracks, limit max 50 ──
    const endpointUrl = `https://api.spotify.com/v1/playlists/${id}/items?limit=50`;
    console.log("[playlist-tracks] calling endpoint:", endpointUrl.split("?")[0]);
    let url: string | null = endpointUrl;

    while (url) {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });

        console.log("[playlist-tracks] Spotify response status:", res.status, "url:", url.split("?")[0]);

        if (!res.ok) {
            const raw = await res.json().catch(() => ({}));
            console.log("[playlist-tracks] Spotify error body:", JSON.stringify(raw));
            return NextResponse.json(
                { error: "Spotify API error", status: res.status, detail: raw },
                { status: res.status }
            );
        }

        const page = (await res.json()) as SpotifyItemsPage;

        for (const item of page.items) {
            // Use new `item` field; fall back to deprecated `track` for safety
            const trackData = item.item ?? item.track;
            if (!trackData) continue; // skip local files, deleted tracks, episodes

            tracks.push({
                trackId: trackData.id,
                trackName: trackData.name,
                albumId: trackData.album.id,
                albumName: trackData.album.name,
                albumCoverUrl: trackData.album.images[0]?.url ?? "",
            });
        }

        url = page.next;
    }

    console.log(`[playlist-tracks] returning ${tracks.length} tracks for playlist ${id}`);
    return NextResponse.json({ tracks });
}
