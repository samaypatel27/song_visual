"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type TimeRange = "short_term" | "medium_term" | "long_term";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  short_term: "Last 4 Weeks",
  medium_term: "Last 6 Months",
  long_term: "Last 12 Months",
};

interface TrackData {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumCoverUrl: string;
  rank: number;
  recentPlayCount: number;
  albumId: string;
}

interface ArtistData {
  artistId: string;
  artistName: string;
  artistImageUrl: string;
}

interface ArtistStat {
  name: string;
  count: number;
  pct: number;
  imageUrl: string;
}

interface AlbumStat {
  albumId: string;
  albumName: string;
  artistName: string;
  coverUrl: string;
  count: number;
}

// ── Treemap helpers ────────────────────────────────────────────────────────

interface TreemapRect {
  artist: ArtistStat;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Worst aspect ratio for a strip laid along `side` with the given item areas
function worstAspect(areas: number[], side: number): number {
  const s = areas.reduce((a, b) => a + b, 0);
  if (s === 0) return Infinity;
  const rmax = Math.max(...areas);
  const rmin = Math.min(...areas);
  if (rmin === 0) return Infinity;
  return Math.max((side * side * rmax) / (s * s), (s * s) / (side * side * rmin));
}

// Lay a row of items into the current bounds. Returns the remaining bounds.
function layoutStrip(
  row: ArtistStat[], rowAreas: number[],
  x: number, y: number, w: number, h: number,
  result: TreemapRect[]
): [number, number, number, number] {
  const rowTotal = rowAreas.reduce((a, b) => a + b, 0);
  if (w >= h) {
    // Landscape: lay a vertical column along the left edge (shorter side = h)
    const stripW = rowTotal / h;
    let curY = y;
    for (let i = 0; i < row.length; i++) {
      const ih = rowAreas[i] / stripW;
      result.push({ artist: row[i], x, y: curY, w: stripW, h: ih });
      curY += ih;
    }
    return [x + stripW, y, w - stripW, h];
  } else {
    // Portrait: lay a horizontal row along the top edge (shorter side = w)
    const stripH = rowTotal / w;
    let curX = x;
    for (let i = 0; i < row.length; i++) {
      const iw = rowAreas[i] / stripH;
      result.push({ artist: row[i], x: curX, y, w: iw, h: stripH });
      curX += iw;
    }
    return [x, y + stripH, w, h - stripH];
  }
}

function squarifyInto(
  items: ArtistStat[], areas: number[],
  x: number, y: number, w: number, h: number,
  result: TreemapRect[]
): void {
  if (items.length === 0) return;
  if (items.length === 1) {
    result.push({ artist: items[0], x, y, w, h });
    return;
  }
  // The "shorter" side determines aspect ratio optimality
  const side = Math.min(w, h);
  let row: ArtistStat[] = [];
  let rowAreas: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const withNext = [...rowAreas, areas[i]];
    if (rowAreas.length === 0 || worstAspect(withNext, side) <= worstAspect(rowAreas, side)) {
      row.push(items[i]);
      rowAreas.push(areas[i]);
    } else {
      const [nx, ny, nw, nh] = layoutStrip(row, rowAreas, x, y, w, h, result);
      squarifyInto(items.slice(i), areas.slice(i), nx, ny, nw, nh, result);
      return;
    }
  }
  layoutStrip(row, rowAreas, x, y, w, h, result);
}

function buildTreemapLayout(items: ArtistStat[], W: number, H: number): TreemapRect[] {
  const sorted = [...items].filter((a) => a.count > 0).sort((a, b) => b.count - a.count);
  const total = sorted.reduce((s, a) => s + a.count, 0);
  if (total === 0 || sorted.length === 0) return [];
  const totalArea = W * H;
  const areas = sorted.map((a) => (a.count / total) * totalArea);
  const result: TreemapRect[] = [];
  squarifyInto(sorted, areas, 0, 0, W, H, result);
  return result;
}

const CANVAS_W = 900;
const CANVAS_H = 420;
const MIN_LABEL_W = 44;
const MIN_LABEL_H = 32;

function ArtistTreemap({ artists }: { artists: ArtistStat[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const rects = buildTreemapLayout(artists, CANVAS_W, CANVAS_H);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: `${CANVAS_H}px`,
        borderRadius: "12px",
        overflow: "hidden",
        background: "#0a0a0f",
      }}
    >
      {rects.map((rect, i) => {
        const isHovered = hoveredIndex === i;
        const showLabel = rect.w >= MIN_LABEL_W && rect.h >= MIN_LABEL_H;
        const showCount = rect.w >= 80 && rect.h >= 56;
        const fontSize = rect.w > 160 ? "13px" : rect.w > 80 ? "11px" : "9px";

        return (
          <div
            key={rect.artist.name}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              position: "absolute",
              left: `${(rect.x / CANVAS_W) * 100}%`,
              top: `${(rect.y / CANVAS_H) * 100}%`,
              width: `${(rect.w / CANVAS_W) * 100}%`,
              height: `${(rect.h / CANVAS_H) * 100}%`,
              backgroundImage: rect.artist.imageUrl ? `url(${rect.artist.imageUrl})` : "none",
              backgroundColor: "#1a1a24",
              backgroundSize: "cover",
              backgroundPosition: "center",
              boxSizing: "border-box",
              border: "2px solid #0a0a0f",
              zIndex: isHovered ? 2 : 1,
              cursor: "default",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              filter: isHovered ? "brightness(1.15)" : "brightness(0.85)",
              transition: "filter 0.15s ease",
            }}
          >
            {/* Gradient scrim for text legibility */}
            {showLabel && (
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)",
                pointerEvents: "none",
              }} />
            )}

            {showLabel && (
              <div style={{ position: "relative", zIndex: 1, padding: "6px 8px" }}>
                <div style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.95)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.2,
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}>
                  {rect.artist.name}
                </div>
                {showCount && (
                  <div style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "10px",
                    color: "rgba(255,255,255,0.65)",
                    marginTop: "2px",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}>
                    {rect.artist.count} track{rect.artist.count !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}

            {/* Tooltip for tiny cells */}
            {isHovered && !showLabel && (
              <div style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(20,20,28,0.96)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "6px",
                padding: "5px 10px",
                pointerEvents: "none",
                zIndex: 20,
                whiteSpace: "nowrap",
              }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
                  {rect.artist.name}
                </div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                  {rect.artist.count} track{rect.artist.count !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "20px 24px", flex: "1 1 140px" }}>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "32px", fontWeight: 700, color: "rgba(255,255,255,0.95)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "6px" }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" }}>
      {children}
    </h3>
  );
}

function Skeleton() {
  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: "56px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite", opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MusicStats() {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [artistImages, setArtistImages] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("short_term");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/spotify/top-tracks?time_range=${timeRange}`).then((r) => r.json()),
      fetch(`/api/spotify/top-artists?time_range=${timeRange}`).then((r) => r.json()),
    ])
      .then(([trackData, artistData]) => {
        setTracks(trackData.tracks ?? []);
        const imgMap = new Map<string, string>();
        for (const a of (artistData.artists ?? []) as ArtistData[]) {
          if (a.artistImageUrl) imgMap.set(a.artistName, a.artistImageUrl);
        }
        setArtistImages(imgMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeRange]);

  // Derived stats
  const uniqueArtists = new Set(tracks.map((t) => t.artistName)).size;
  const uniqueAlbums = new Set(tracks.map((t) => t.albumId)).size;
  const totalRecentPlays = tracks.reduce((s, t) => s + t.recentPlayCount, 0);

  // Top 6 artists by track count, with image URLs
  const artistCountMap = new Map<string, { count: number; coverUrl: string }>();
  for (const t of tracks) {
    if (!artistCountMap.has(t.artistName)) {
      artistCountMap.set(t.artistName, { count: 0, coverUrl: t.albumCoverUrl });
    }
    artistCountMap.get(t.artistName)!.count++;
  }
  const topArtists: ArtistStat[] = [...artistCountMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([name, { count, coverUrl }]) => ({
      name,
      count,
      pct: count / tracks.length,
      imageUrl: artistImages.get(name) || coverUrl,
    }));

  // Most replayed
  const mostReplayed = [...tracks]
    .filter((t) => t.recentPlayCount > 0)
    .sort((a, b) => b.recentPlayCount - a.recentPlayCount)
    .slice(0, 5);

  // Top albums
  const albumMap = new Map<string, AlbumStat>();
  for (const t of tracks) {
    if (!albumMap.has(t.albumId)) {
      albumMap.set(t.albumId, { albumId: t.albumId, albumName: t.albumName, artistName: t.artistName, coverUrl: t.albumCoverUrl, count: 0 });
    }
    albumMap.get(t.albumId)!.count++;
  }
  const topAlbums: AlbumStat[] = [...albumMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div style={{ width: "100%", background: "#0a0a0f", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 24px 100px", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ width: "100%", maxWidth: "900px", marginBottom: "32px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: "22px", fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: 0, letterSpacing: "-0.01em" }}>
            Your Stats
          </h2>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>
            {loading ? "Loading your top tracks…" : `Derived from your top 50 tracks · ${TIME_RANGE_LABELS[timeRange]}`}
          </p>
        </div>

        {/* Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.75)", fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, cursor: "pointer", transition: "background 0.15s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          >
            {TIME_RANGE_LABELS[timeRange]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {dropdownOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: "160px", background: "rgba(20,20,28,0.96)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", overflow: "hidden", zIndex: 100, backdropFilter: "blur(12px)" }}>
              {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([value, label]) => (
                <button key={value} onClick={() => { setTimeRange(value); setDropdownOpen(false); }}
                  style={{ display: "block", width: "100%", padding: "10px 16px", textAlign: "left", background: timeRange === value ? "rgba(29,185,84,0.15)" : "transparent", border: "none", color: timeRange === value ? "#1DB954" : "rgba(255,255,255,0.7)", fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: timeRange === value ? 600 : 400, cursor: "pointer", transition: "background 0.1s ease" }}
                  onMouseEnter={(e) => { if (timeRange !== value) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { if (timeRange !== value) e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? <Skeleton /> : (
        <div style={{ width: "100%", maxWidth: "900px", display: "flex", flexDirection: "column", gap: "40px" }}>

          {/* Overview */}
          <div>
            <SectionLabel>Overview</SectionLabel>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <StatCard label="Top Tracks" value={tracks.length} sub="in your rotation" />
              <StatCard label="Unique Artists" value={uniqueArtists} sub="represented" />
              <StatCard label="Unique Albums" value={uniqueAlbums} sub="in your top 50" />
              <StatCard label="Recent Plays" value={totalRecentPlays} sub="logged in last 50" />
            </div>
          </div>

          {/* Artist treemap */}
          <div>
            <SectionLabel>Most represented artists</SectionLabel>
            <ArtistTreemap artists={topArtists} />
          </div>

          {/* Most replayed */}
          {mostReplayed.length > 0 && (
            <div>
              <SectionLabel>Most replayed recently</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {mostReplayed.map((t, i) => (
                  <div key={t.trackId} style={{ display: "grid", gridTemplateColumns: "20px 36px 1fr auto", alignItems: "center", gap: "0 12px", padding: "8px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</span>
                    <div style={{ width: "36px", height: "36px", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                      {t.albumCoverUrl && <Image src={t.albumCoverUrl} alt={t.albumName} width={36} height={36} style={{ objectFit: "cover", width: "100%", height: "100%" }} />}
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.trackName}</div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.artistName}</div>
                    </div>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>×{t.recentPlayCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top albums */}
          <div>
            <SectionLabel>Most represented albums</SectionLabel>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {topAlbums.map((a) => (
                <div key={a.albumId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px 10px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
                    {a.coverUrl && <Image src={a.coverUrl} alt={a.albumName} width={40} height={40} style={{ objectFit: "cover", width: "100%", height: "100%" }} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.albumName}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>{a.artistName} · {a.count} track{a.count !== 1 ? "s" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
