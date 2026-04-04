import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

const localCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60_000;
const CACHE_KEY = "top-tracks";

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

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cached = localCache.get(CACHE_KEY);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
    }

    const headers = { Authorization: `Bearer ${session.accessToken}` };

    const [topRes, recentRes] = await Promise.all([
        fetch("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50", { headers }),
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

    // Build a count map of track id → number of appearances in recently played
    const recentPlayCounts = new Map<string, number>();
    for (const item of (recentData.items ?? []) as SpotifyRecentlyPlayedItem[]) {
        const id = item.track?.id;
        if (id) {
            recentPlayCounts.set(id, (recentPlayCounts.get(id) ?? 0) + 1);
        }
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

    console.log(`[top-tracks] fetched ${tracks.length} tracks | recently-played cross-reference complete`);

    const payload = { tracks };
    localCache.set(CACHE_KEY, { data: payload, timestamp: Date.now() });

    return NextResponse.json(payload);
}
