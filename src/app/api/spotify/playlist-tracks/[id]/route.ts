import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// Module-level in-memory cache
interface CacheEntry {
    data: any;
    timestamp: number;
}
const localCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 60 seconds

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

// TYPES
interface SpotifyImage {
    url: string;
}

interface SpotifyPlaylistItem {
    item: { type?: string; id?: string; name?: string; album?: { id?: string; name?: string; images?: SpotifyImage[] } } | null;
    track: { type?: string; id?: string; name?: string; album?: { id?: string; name?: string; images?: SpotifyImage[] } } | null;
}

interface SpotifyItemsPage {
    items: SpotifyPlaylistItem[];
    next: string | null;
    total: number;
    limit: number;
    offset: number;
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

    // Extract pagination parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Cache layer — module-level Map keyed by id, limit, and offset
    const cacheKey = `${id}_${limit}_${offset}`;
    const cachedEntry = localCache.get(cacheKey);

    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
        console.log(`[playlist-tracks] Cache HIT (local) — returning paginated tracks for limit=${limit} offset=${offset}`);
        return NextResponse.json(cachedEntry.data);
    }

    console.log(`[playlist-tracks] Cache MISS (local) — fetching from Spotify for limit=${limit} offset=${offset}`);

    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const url = `https://api.spotify.com/v1/playlists/${id}/items?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
        const raw = await res.json().catch(() => ({}));
        return NextResponse.json({ error: "Spotify API error", status: res.status, detail: raw }, { status: res.status });
    }

    const page = (await res.json()) as SpotifyItemsPage;
    const allItems: SpotifyPlaylistItem[] = page.items ?? [];

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

    console.log(`[playlist-tracks] valid covers: ${validCover} | missing: ${missingCover} | null: ${skippedNull} | episodes: ${skippedEpisode} | final: ${tracks.length}`);

    // Construct augmented response payload
    const responsePayload = {
        tracks,
        total: page.total,
        limit: page.limit || limit,
        offset: page.offset || offset,
        next: page.next
    };

    // Store in internal cache
    localCache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });
    
    return NextResponse.json(responsePayload);
}
