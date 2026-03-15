import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const playlists = (data.items as { id: string; name: string }[]).map(
        ({ id, name }) => ({ id, name })
    );

    return NextResponse.json({ playlists });
}
