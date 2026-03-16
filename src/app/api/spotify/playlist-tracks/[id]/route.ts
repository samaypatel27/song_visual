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

    console.log("[playlist-tracks] route hit, id:", id);
    console.log("[playlist-tracks] accessToken present:", !!session?.accessToken, "| prefix:", session?.accessToken?.slice(0, 12) ?? "MISSING");

    if (!session?.accessToken) {
        console.log("[playlist-tracks] 401 — no access token in session");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pre-check: confirm token is alive
    const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    console.log("[playlist-tracks] /me status:", meRes.status);
    if (!meRes.ok) {
        const meBody = await meRes.json().catch(() => ({}));
        console.log("[playlist-tracks] token expired or invalid:", JSON.stringify(meBody));
        return NextResponse.json({ error: "Token invalid — please re-authenticate", detail: meBody }, { status: meRes.status });
    }

    // ── Pagination loop ─────────────────────────────────────────────────────
    let allItems: SpotifyPlaylistItem[] = [];
    let offset = 0;
    const limit = 50; // Feb 2026 API max is 50 (was 100 on /tracks endpoint)

    while (true) {
        const pageUrl = `https://api.spotify.com/v1/playlists/${id}/items?limit=${limit}&offset=${offset}`;
        console.log(`[playlist-tracks] fetching offset ${offset}:`, pageUrl.split("?")[0]);

        const res = await fetch(pageUrl, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
        });

        console.log("[playlist-tracks] Spotify response status:", res.status);

        if (!res.ok) {
            const raw = await res.json().catch(() => ({}));
            console.log("[playlist-tracks] Spotify error body:", JSON.stringify(raw));
            return NextResponse.json({ error: "Spotify API error", status: res.status, detail: raw }, { status: res.status });
        }

        const page = (await res.json()) as SpotifyItemsPage;
        const pageItems = page.items ?? [];

        console.log(`[playlist-tracks] page at offset ${offset}: ${pageItems.length} items, next: ${!!page.next}`);

        // Diagnose the raw shape of the first 3 items on the first page
        if (offset === 0) {
            pageItems.slice(0, 3).forEach((pi, i) => {
                console.log(`[playlist-tracks] raw item[${i}]:`, JSON.stringify({
                    hasItem: !!pi.item,
                    hasTrack: !!pi.track,
                    itemType: pi.item?.type ?? "null",
                    itemName: pi.item?.name ?? "null",
                    albumImages: pi.item?.album?.images?.length ?? "no album",
                }));
            });
        }

        allItems = allItems.concat(pageItems);
        if (!page.next || pageItems.length === 0) break;
        offset += limit;
    }

    console.log("[playlist-tracks] total items from Spotify:", allItems.length);

    // ── Map items → TrackData ───────────────────────────────────────────────
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
