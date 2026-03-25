import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const localCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 300_000; // 5 minutes

export async function GET(
  req: Request,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { albumId } = await params;

  const cached = localCache.get(albumId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const res = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`,
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

  const tracks = (data.items ?? []).map((t: any) => ({
    trackNumber: t.track_number as number,
    trackName: (t.name ?? "") as string,
    durationMs: (t.duration_ms ?? 0) as number,
  }));

  const payload = { tracks };
  localCache.set(albumId, { data: payload, timestamp: Date.now() });

  return NextResponse.json(payload);
}
