import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

interface AudioFeatures {
    id: string;
    danceability: number;
    energy: number;
    valence: number;
    acousticness: number;
    instrumentalness: number;
    speechiness: number;
    liveness: number;
    tempo: number;
}

export interface ListeningStatsData {
    audioFeatures: {
        danceability: number;
        energy: number;
        valence: number;
        acousticness: number;
        instrumentalness: number;
        speechiness: number;
        liveness: number;
        tempo: number;
    };
    genreSeeds: string[];
    trackCount: number;
}

async function spotifyGet(url: string, token: string) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        console.error(`[listening-stats] GET ${url} → ${res.status}`);
        return null;
    }
    return res.json();
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheKey = `listening-stats:${session.accessToken.slice(0, 16)}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.expiresAt) {
        return NextResponse.json(hit.data);
    }

    const token = session.accessToken;

    // Fetch top 50 tracks and genre seeds in parallel
    const [topData, genreData] = await Promise.all([
        spotifyGet("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50", token),
        spotifyGet("https://api.spotify.com/v1/recommendations/available-genre-seeds", token),
    ]);

    if (!topData) {
        return NextResponse.json({ error: "Failed to fetch top tracks" }, { status: 502 });
    }

    const trackIds: string[] = (topData.items ?? [])
        .filter(Boolean)
        .map((t: { id: string }) => t.id)
        .filter(Boolean);

    // Batch-fetch audio features (max 100 IDs per request)
    const ids = trackIds.slice(0, 50).join(",");
    const featuresData = ids
        ? await spotifyGet(`https://api.spotify.com/v1/audio-features?ids=${ids}`, token)
        : null;

    const features: AudioFeatures[] = (featuresData?.audio_features ?? []).filter(Boolean);

    // Average all numeric audio feature fields
    const avg = (key: keyof Omit<AudioFeatures, "id">) => {
        if (features.length === 0) return 0;
        return features.reduce((sum, f) => sum + (f[key] ?? 0), 0) / features.length;
    };

    const audioFeatures = {
        danceability: avg("danceability"),
        energy: avg("energy"),
        valence: avg("valence"),
        acousticness: avg("acousticness"),
        instrumentalness: avg("instrumentalness"),
        speechiness: avg("speechiness"),
        liveness: avg("liveness"),
        tempo: avg("tempo"),
    };

    const payload: ListeningStatsData = {
        audioFeatures,
        genreSeeds: genreData?.genres ?? [],
        trackCount: features.length,
    };

    console.log(`[listening-stats] ${features.length} tracks averaged | energy: ${audioFeatures.energy.toFixed(2)} | valence: ${audioFeatures.valence.toFixed(2)}`);

    cache.set(cacheKey, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(payload);
}
