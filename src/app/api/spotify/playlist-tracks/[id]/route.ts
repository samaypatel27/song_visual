import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface SpotifyImage {
    url: string;
}

// SpotifyPlaylistItem fields are typed loosely on purpose — the Feb 2026 API
// can return either a TrackObject or an EpisodeObject in the `item` field.
// We use `any` and check `.type` at runtime to safely skip episodes.
interface SpotifyPlaylistItem {
    item: { type?: string; id?: string; name?: string; album?: { id?: string; name?: string; images?: SpotifyImage[] } } | null;
    track: { type?: string; id?: string; name?: string; album?: { id?: string; name?: string; images?: SpotifyImage[] } } | null;
}

interface SpotifyItemsPage {
    items: SpotifyPlaylistItem[];
    next: string | null;
    total: number;
}

export interface TrackData {
    trackId: string;
    trackName: string;
    albumId: string;
    albumName: string;
    albumCoverUrl: string;
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const limit = 50;

    // Fetch first page to get total count 
    const firstUrl = `https://api.spotify.com/v1/playlists/${id}/items?limit=${limit}&offset=0`;
    const firstRes = await fetch(firstUrl, { headers });

    if (!firstRes.ok) {
        const raw = await firstRes.json().catch(() => ({}));
        return NextResponse.json({ error: "Spotify API error", status: firstRes.status, detail: raw }, { status: firstRes.status });
    }

    const firstPage = (await firstRes.json()) as SpotifyItemsPage;
    let allItems: SpotifyPlaylistItem[] = [...(firstPage.items ?? [])];

    // Fetch remaining pages in parallel 
    if (firstPage.next && firstPage.total > limit) {
        const remainingPages = Math.ceil((firstPage.total - limit) / limit);
        const offsets = Array.from({ length: remainingPages }, (_, i) => (i + 1) * limit);

        const pages = await Promise.all(
            offsets.map(async (offset) => {
                const url = `https://api.spotify.com/v1/playlists/${id}/items?limit=${limit}&offset=${offset}`;
                const res = await fetch(url, { headers });
                if (!res.ok) return { items: [], next: null, total: 0 };
                return res.json() as Promise<SpotifyItemsPage>;
            })
        );

        for (const page of pages) {
            allItems = allItems.concat(page.items ?? []);
        }
    }

    console.log("[playlist-tracks] total items from Spotify:", allItems.length);

    // Map items → TrackData 
    let validCover = 0;
    let missingCover = 0;
    let skippedNull = 0;
    let skippedEpisode = 0;

    const tracks: TrackData[] = [];

    allItems.forEach((pi, i) => {
        // Use new `item` field; fall back to deprecated `track` for safety
        const raw = pi.item ?? pi.track;

        if (!raw) {
            console.warn(`[playlist-tracks] item[${i}] — both item and track are null (local file / deleted), skipping`);
            skippedNull++;
            return;
        }

        // TYPE GUARD: skip podcast episodes — they have no .album field
        // item.type is 'track' for songs, 'episode' for podcasts
        if (raw.type && raw.type !== "track") {
            console.warn(`[playlist-tracks] item[${i}] "${raw.name}" is type "${raw.type}" (not a track) — skipping`);
            skippedEpisode++;
            return;
        }

        if (!raw.album) {
            console.warn(`[playlist-tracks] item[${i}] "${raw.name ?? "?"}" has no album object`);
            missingCover++;
            return;
        }

        if (!raw.album.images || raw.album.images.length === 0) {
            console.warn(`[playlist-tracks] item[${i}] "${raw.name}" album "${raw.album.name}" has empty images array`);
            missingCover++;
            return;
        }

        const coverUrl = raw.album.images[0]?.url;
        if (!coverUrl) {
            console.warn(`[playlist-tracks] item[${i}] "${raw.name}" images[0].url is undefined`);
            missingCover++;
            return;
        }

        validCover++;
        tracks.push({
            trackId: raw.id ?? "",
            trackName: raw.name ?? "",
            albumId: raw.album.id ?? "",
            albumName: raw.album.name ?? "",
            albumCoverUrl: coverUrl,
        });
    });

    console.log(`[playlist-tracks] valid covers: ${validCover} | missing covers: ${missingCover} | skipped null: ${skippedNull} | skipped episodes: ${skippedEpisode} | final: ${tracks.length}`);
    return NextResponse.json({ tracks });
}
