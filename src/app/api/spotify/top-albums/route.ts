import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cache } from "@/lib/cache";

const CACHE_TTL_MS = 60_000; // 60 seconds

export interface AlbumGalleryItem {
    common: string;   // albumName
    binomial: string; // artistName
    photo: {
        url: string;  // albumCoverUrl
        text: string; // `${albumName} by ${artistName}`
        by: string;   // artistName
    };
}

interface SpotifyTrack {
    id: string;
    album: {
        id: string;
        name: string;
        images: { url: string }[];
    };
    artists: { name: string }[];
}

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheKey = `top-albums:${session.accessToken.slice(0, 16)}`;
    const cached = cache.get<AlbumGalleryItem[]>(cacheKey);
    if (cached) {
        return NextResponse.json({ albums: cached });
    }

    const res = await fetch(
        "https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=50",
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        return NextResponse.json(
            { error: "Spotify API error", status: res.status, detail },
            { status: res.status }
        );
    }

    const data = await res.json();
    const tracks: SpotifyTrack[] = data.items ?? [];

    // Deduplicate by albumId; count how many top-50 tracks each album has
    const albumMap = new Map<string, { item: AlbumGalleryItem; count: number }>();
    for (const track of tracks) {
        const albumId = track.album.id;
        if (!albumId) continue;
        if (albumMap.has(albumId)) {
            albumMap.get(albumId)!.count += 1;
        } else {
            const coverUrl = track.album.images[0]?.url ?? "";
            if (!coverUrl) continue; // skip albums with no art
            const albumName = track.album.name;
            const artistName = track.artists[0]?.name ?? "";
            albumMap.set(albumId, {
                count: 1,
                item: {
                    common: albumName,
                    binomial: artistName,
                    photo: {
                        url: coverUrl,
                        text: `${albumName} by ${artistName}`,
                        by: artistName,
                    },
                },
            });
        }
    }

    // Sort by number of top-50 tracks (most represented albums first)
    const albums: AlbumGalleryItem[] = [...albumMap.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        .map((v) => v.item);

    cache.set(cacheKey, albums, CACHE_TTL_MS);

    console.log(`[top-albums] returning ${albums.length} unique albums from long_term top tracks`);

    return NextResponse.json({ albums });
}
