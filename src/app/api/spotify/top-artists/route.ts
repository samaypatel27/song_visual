import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

const localCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60_000;
const CACHE_KEY = "top-artists";

interface SpotifyArtist {
    id: string;
    name: string;
    images: { url: string }[];
    genres: string[];
    followers: { total: number };
    popularity: number;
}

export interface ArtistData {
    artistId: string;
    artistName: string;
    artistImageUrl: string;
    rank: number;
    genres: string[];
    followers: number;
    popularity: number;
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

    const res = await fetch(
        "https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=10",
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

    const artists: ArtistData[] = (data.items ?? []).map(
        (artist: SpotifyArtist, index: number) => ({
            artistId: artist.id,
            artistName: artist.name,
            artistImageUrl: artist.images[0]?.url ?? "",
            rank: index + 1,
            genres: artist.genres?.slice(0, 2) ?? [],
            followers: artist.followers?.total ?? 0,
            popularity: artist.popularity ?? 0,
        })
    );

    console.log(`[top-artists] fetched ${artists.length} artists`);

    const payload = { artists };
    localCache.set(CACHE_KEY, { data: payload, timestamp: Date.now() });

    return NextResponse.json(payload);
}
