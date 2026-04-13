import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

// NOTE: Requires the user-read-recently-played scope.
// If the user authenticated before this scope was added they must
// log out and re-authenticate to grant it — existing tokens will not
// have it retroactively.

interface SpotifyImage {
    url: string;
}

interface SpotifyRecentlyPlayedItem {
    track: {
        id?: string;
        name?: string;
        artists?: { name: string }[];
        album?: {
            name?: string;
            images?: SpotifyImage[];
        };
    };
    played_at: string;
}

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[recently-played] fetching 5 most recently played tracks");

    const res = await fetch(
        "https://api.spotify.com/v1/me/player/recently-played?limit=5",
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
    );

    console.log("[recently-played] Spotify status:", res.status);

    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        return NextResponse.json(
            { error: "Spotify API error", status: res.status, detail },
            { status: res.status }
        );
    }

    const data = await res.json();

    const tracks = (data.items ?? [] as SpotifyRecentlyPlayedItem[]).map((item: SpotifyRecentlyPlayedItem) => ({
        trackId: item.track.id ?? "",
        trackName: item.track.name ?? "",
        artistName: item.track.artists?.map((a) => a.name).join(", ") ?? "",
        albumName: item.track.album?.name ?? "",
        albumCoverUrl: item.track.album?.images?.[0]?.url ?? "",
        playedAt: item.played_at,
    }));

    console.log("[recently-played] returning track count:", tracks.length);

    return NextResponse.json({ tracks });
}
