import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

const localCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60_000;

type TimeRange = "short_term" | "medium_term" | "long_term";
const VALID_RANGES = new Set<string>(["short_term", "medium_term", "long_term"]);

interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    album: {
        id: string;
        name: string;
        images: { url: string }[];
    };
}

interface SpotifyRecentlyPlayedItem {
    track: SpotifyTrack;
}

export interface TrackData {
    trackId: string;
    trackName: string;
    artistName: string;
    albumName: string;
    albumCoverUrl: string;
    rank: number;
    recentPlayCount: number;
    albumId: string;
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get("time_range") ?? "short_term";
    const timeRange: TimeRange = VALID_RANGES.has(rawRange) ? (rawRange as TimeRange) : "short_term";

    const cacheKey = `top-tracks:${timeRange}`;
    const cached = localCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
    }

    const headers = { Authorization: `Bearer ${session.accessToken}` };

    const [topRes, recentRes] = await Promise.all([
        fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`, { headers }),
        fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", { headers }),
    ]);

    if (!topRes.ok) {
        const detail = await topRes.json().catch(() => ({}));
        return NextResponse.json(
            { error: "Spotify API error", status: topRes.status, detail },
            { status: topRes.status }
        );
    }

    if (!recentRes.ok) {
        const detail = await recentRes.json().catch(() => ({}));
        return NextResponse.json(
            { error: "Spotify API error", status: recentRes.status, detail },
            { status: recentRes.status }
        );
    }

    const [topData, recentData] = await Promise.all([topRes.json(), recentRes.json()]);

    const recentPlayCounts = new Map<string, number>();
    for (const item of (recentData.items ?? []) as SpotifyRecentlyPlayedItem[]) {
        const id = item.track?.id;
        if (id) recentPlayCounts.set(id, (recentPlayCounts.get(id) ?? 0) + 1);
    }

    const tracks: TrackData[] = (topData.items ?? []).map(
        (track: SpotifyTrack, index: number) => ({
            trackId: track.id,
            trackName: track.name,
            artistName: track.artists[0]?.name ?? "",
            albumName: track.album?.name ?? "",
            albumCoverUrl: track.album?.images[0]?.url ?? "",
            rank: index + 1,
            recentPlayCount: recentPlayCounts.get(track.id) ?? 0,
            albumId: track.album?.id ?? "",
        })
    );

    console.log(`[top-tracks] fetched ${tracks.length} tracks (${timeRange})`);

    const payload = { tracks };
    localCache.set(cacheKey, { data: payload, timestamp: Date.now() });

    return NextResponse.json(payload);
}
