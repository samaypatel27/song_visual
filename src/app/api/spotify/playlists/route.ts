import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cache, TTL, playlistsKey } from "@/lib/cache";

interface PlaylistItem {
    id: string;
    name: string;
}

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cache layer — return cached playlists if available 
    const cacheKey = playlistsKey(session.accessToken);
    const cached = cache.get<PlaylistItem[]>(cacheKey);

    if (cached) {
        console.log("[playlists] Cache HIT — returning cached playlists");
        return NextResponse.json({ playlists: cached });
    }

    console.log("[playlists] Cache MISS — fetching from Spotify");

    const res = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
    });

    if (!res.ok) {
        return NextResponse.json(
            { error: "Failed to fetch playlists from Spotify" },
            { status: res.status }
        );
    }

    const data = await res.json();

    // Only return what the UI needs — name + id
    const playlists: PlaylistItem[] = (data.items as { id: string; name: string }[]).map(
        ({ id, name }) => ({ id, name })
    );

    // Store in cache (TTL: 5 minutes) 
    cache.set(cacheKey, playlists, TTL.PLAYLISTS);
    console.log(`[playlists] Cached ${playlists.length} playlists (TTL: ${TTL.PLAYLISTS / 1000}s)`);

    return NextResponse.json({ playlists });
}
