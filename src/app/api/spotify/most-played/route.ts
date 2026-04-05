import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    // Spotfy supports 'short_term', 'medium_term', 'long_term'
    const timeRange = searchParams.get("time_range") || "short_term";

    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await fetch(
        `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=25`,
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

    const tracks = (data.items ?? []).map((track: any) => ({
        songName: track.name,
        albumName: track.album?.name ?? "",
        albumCoverUrl: track.album?.images?.[0]?.url ?? "",
        artistName: track.artists?.map((a: any) => a.name).join(", ") ?? "",
        durationMs: track.duration_ms ?? 0,
    }));

    return NextResponse.json({ tracks });
}
