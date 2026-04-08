import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

type TimeRange = "short_term" | "medium_term" | "long_term";
const VALID_RANGES = new Set<string>(["short_term", "medium_term", "long_term"]);

export interface ArtistData {
    artistId: string;
    artistName: string;
    artistImageUrl: string;
    rank: number;
    genres: string[];
    followers: number;
    spotifyUrl: string;
}

async function spotifyGet(url: string, token: string) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[top-artists] GET ${url} → ${res.status}`, body);
        return null;
    }
    return res.json();
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get("time_range") ?? "short_term";
    const timeRange: TimeRange = VALID_RANGES.has(rawRange)
        ? (rawRange as TimeRange)
        : "short_term";

    const cacheKey = `top-artists:${timeRange}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() < hit.expiresAt) {
        return NextResponse.json(hit.data);
    }

    // Step 1: get ranked list of top artists
    const topData = await spotifyGet(
        `https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=10`,
        session.accessToken
    );
    if (!topData) {
        return NextResponse.json({ error: "Failed to fetch top artists" }, { status: 502 });
    }

    const topItems: { id: string; name: string; external_urls: { spotify: string } }[] =
        (topData.items ?? []).filter(Boolean);

    // Log the FULL first item so we can see exactly what Spotify returns
    console.log("[top-artists] raw topItems[0] keys:", Object.keys(topData.items?.[0] ?? {}));
    console.log("[top-artists] raw topItems[0]:", JSON.stringify(topData.items?.[0]));

    // Step 2: fetch full artist objects individually to get genres + followers
    const fullResults = await Promise.all(
        topItems.map((a) =>
            spotifyGet(`https://api.spotify.com/v1/artists/${a.id}`, session.accessToken!)
        )
    );

    console.log("[top-artists] first full artist:", JSON.stringify(fullResults[0]));

    const artists: ArtistData[] = topItems.map((item, index) => {
        const full = fullResults[index];
        return {
            artistId: item.id,
            artistName: item.name,
            artistImageUrl: full?.images?.[0]?.url ?? "",
            rank: index + 1,
            genres: full?.genres?.slice(0, 2) ?? [],
            followers: full?.followers?.total ?? 0,
            spotifyUrl: item.external_urls?.spotify ?? "",
        };
    });

    const payload = { artists };
    cache.set(cacheKey, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });

    return NextResponse.json(payload);
}
