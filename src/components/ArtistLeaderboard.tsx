"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface ArtistData {
  artistId: string;
  artistName: string;
  artistImageUrl: string;
  rank: number;
  genres: string[];
  followers: number;
  spotifyUrl: string;
}

type TimeRange = "short_term" | "medium_term" | "long_term";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  short_term: "4 WKS",
  medium_term: "6 MO",
  long_term: "1 YR",
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

const RANK_COLORS: Record<number, { color: string; glow: string; label: string }> = {
  1: { color: "#FFD700", glow: "0 0 8px #FFD700aa", label: "1ST" },
  2: { color: "#C0C0C0", glow: "0 0 8px #C0C0C0aa", label: "2ND" },
  3: { color: "#CD7F32", glow: "0 0 8px #CD7F32aa", label: "3RD" },
};

// Cabinet colors
const CAB_DARK = "#060e07";
const CAB_MID = "#0d1f10";
const CAB_LIGHT = "#163320";
const GREEN = "#1DB954";

function SpotifyMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={GREEN}
      style={{ filter: `drop-shadow(0 0 5px ${GREEN})`, flexShrink: 0 }}>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export function ArtistLeaderboard() {
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("short_term");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/spotify/top-artists?time_range=${timeRange}`)
      .then((r) => r.json())
      .then((d) => setArtists(d.artists ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeRange]);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0f",
      padding: "24px 16px",
      boxSizing: "border-box",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        @keyframes marqueeGlow {
          0%, 100% { text-shadow: 0 0 8px ${GREEN}, 0 0 18px ${GREEN}88; }
          50%       { text-shadow: 0 0 14px ${GREEN}, 0 0 30px ${GREEN}bb; }
        }
        @keyframes screenFlicker {
          0%,94%,96%,100% { opacity: 1; }
          95% { opacity: 0.91; }
        }
        @keyframes arcadePulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.12; }
        }
        @keyframes blinkCoin {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
        @keyframes ledPulse {
          0%, 100% { opacity: 0.7; box-shadow: 0 0 4px ${GREEN}99; }
          50%       { opacity: 1;   box-shadow: 0 0 8px ${GREEN}, 0 0 14px ${GREEN}66; }
        }
        .arcade-row:hover { background: rgba(29,185,84,0.07) !important; }
      `}</style>

      {/* ── Drop-shadow wrapper (outside clip-path so glow follows the silhouette) ── */}
      <div style={{
        position: "relative",
        width: "min(780px, 100%)",
        filter: `drop-shadow(0 0 3px ${GREEN}) drop-shadow(0 0 28px rgba(29,185,84,0.22)) drop-shadow(0 24px 64px rgba(0,0,0,0.85))`,
      }}>

        {/* ── Cabinet silhouette via clip-path ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          clipPath: "polygon(8% 0%, 92% 0%, 100% 4%, 100% 83%, 92% 91%, 76% 91%, 76% 100%, 63% 100%, 63% 95%, 37% 95%, 37% 100%, 24% 100%, 24% 91%, 8% 91%, 0% 83%, 0% 4%)",
          overflow: "hidden",
        }}>

          {/* ════════════════════════════════════
              MARQUEE
          ════════════════════════════════════ */}
          <div style={{
            background: `linear-gradient(180deg, ${CAB_LIGHT} 0%, ${CAB_MID} 100%)`,
            borderBottom: `3px solid ${GREEN}`,
            padding: "12px 28px 10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            position: "relative",
          }}>
            {/* Top glow stripe */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "3px",
              background: `linear-gradient(90deg, transparent, ${GREEN}, #4ade80, ${GREEN}, transparent)`,
            }} />

            {/* Title row */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <SpotifyMark size={26} />
              <h2 style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "clamp(12px, 2vw, 19px)",
                color: GREEN,
                margin: 0,
                letterSpacing: "0.05em",
                lineHeight: 1.3,
                animation: "marqueeGlow 2.8s ease-in-out infinite",
              }}>
                ARTIST LEADERBOARD
              </h2>
              <SpotifyMark size={26} />
            </div>

            {/* Marquee sub-stripe */}
            <div style={{
              width: "60%",
              height: "2px",
              background: `linear-gradient(90deg, transparent, rgba(29,185,84,0.4), transparent)`,
            }} />
          </div>

          {/* ════════════════════════════════════
              BODY: left panel | screen | right panel
          ════════════════════════════════════ */}
          <div style={{
            display: "flex",
            flexDirection: "row",
            background: CAB_DARK,
          }}>

            {/* ── Left Side Panel ── */}
            <SidePanel side="left" />

            {/* ── Screen Area ── */}
            <div style={{
              flex: 1,
              padding: "16px 0",
              background: `linear-gradient(180deg, ${CAB_MID} 0%, ${CAB_DARK} 100%)`,
              display: "flex",
              flexDirection: "column",
            }}>
              {/* Screen outer bezel */}
              <div style={{
                flex: 1,
                background: "#050c07",
                borderRadius: "8px",
                border: "3px solid #0d2414",
                boxShadow: `
                  inset 0 0 30px rgba(0,0,0,0.95),
                  inset 3px 3px 10px rgba(0,0,0,0.7),
                  inset -3px -3px 10px rgba(0,0,0,0.5),
                  0 0 0 1px rgba(29,185,84,0.08)
                `,
                overflow: "hidden",
                position: "relative",
                animation: "screenFlicker 9s ease-in-out infinite",
              }}>
                {/* Scanlines */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)",
                  zIndex: 10, pointerEvents: "none",
                }} />
                {/* Screen inner glow */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "radial-gradient(ellipse at center, rgba(29,185,84,0.03) 0%, transparent 70%)",
                  zIndex: 9, pointerEvents: "none",
                }} />

                {/* ── Leaderboard content ── */}
                <div style={{ padding: "12px 14px", position: "relative", zIndex: 1 }}>

                  {/* Screen top bar */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: `1px solid rgba(29,185,84,0.25)`,
                    paddingBottom: "7px",
                    marginBottom: "7px",
                  }}>
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: "8px",
                      color: GREEN,
                      letterSpacing: "0.1em",
                    }}>TOP ARTISTS</span>
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: "6px",
                      color: "rgba(29,185,84,0.45)",
                    }}>{TIME_RANGE_LABELS[timeRange]}</span>
                  </div>

                  {/* Column headers */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "34px 36px 1fr 88px 62px 28px",
                    gap: "0 8px",
                    padding: "0 4px 4px",
                    borderBottom: "1px solid rgba(29,185,84,0.12)",
                    marginBottom: "3px",
                  }}>
                    {(["RNK", "", "ARTIST", "GENRE", "FANS", ""] as const).map((h, i) => (
                      <span key={i} style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: "5px",
                        color: "rgba(29,185,84,0.38)",
                        letterSpacing: "0.06em",
                      }}>{h}</span>
                    ))}
                  </div>

                  {/* Artist rows */}
                  <div>
                    {loading
                      ? Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} style={{
                            height: "35px", margin: "2px 0", borderRadius: "3px",
                            background: "rgba(29,185,84,0.04)",
                            animation: "arcadePulse 1.5s ease-in-out infinite",
                            opacity: 1 - i * 0.07,
                          }} />
                        ))
                      : artists.map((artist) => {
                          const isHovered = hoveredId === artist.artistId;
                          const rankMeta = RANK_COLORS[artist.rank];
                          return (
                            <div
                              key={artist.artistId}
                              className="arcade-row"
                              onMouseEnter={() => setHoveredId(artist.artistId)}
                              onMouseLeave={() => setHoveredId(null)}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "34px 36px 1fr 88px 62px 28px",
                                gap: "0 8px",
                                alignItems: "center",
                                padding: "0 4px",
                                height: "35px",
                                margin: "2px 0",
                                borderRadius: "3px",
                                borderLeft: rankMeta
                                  ? `2px solid ${rankMeta.color}`
                                  : `2px solid ${isHovered ? "rgba(29,185,84,0.35)" : "transparent"}`,
                                background: "transparent",
                                cursor: "default",
                                transition: "all 0.12s ease",
                                boxSizing: "border-box",
                              }}
                            >
                              {/* Rank */}
                              <span style={{
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: "7px",
                                color: rankMeta ? rankMeta.color : "rgba(29,185,84,0.5)",
                                textShadow: rankMeta ? rankMeta.glow : "none",
                              }}>
                                {rankMeta ? rankMeta.label : `#${artist.rank}`}
                              </span>

                              {/* Avatar */}
                              <div style={{
                                width: "28px", height: "28px", borderRadius: "50%",
                                overflow: "hidden",
                                border: `1.5px solid ${rankMeta ? rankMeta.color : isHovered ? "rgba(29,185,84,0.45)" : "rgba(29,185,84,0.12)"}`,
                                boxShadow: rankMeta ? rankMeta.glow : "none",
                                flexShrink: 0,
                              }}>
                                {artist.artistImageUrl
                                  ? <Image src={artist.artistImageUrl} alt={artist.artistName} width={28} height={28}
                                      style={{ objectFit: "cover", width: "100%", height: "100%", filter: "saturate(1.15)" }} />
                                  : <div style={{ width: "100%", height: "100%", background: "rgba(29,185,84,0.1)" }} />
                                }
                              </div>

                              {/* Name */}
                              <span style={{
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: "6px",
                                color: isHovered ? "#fff" : "rgba(200,255,210,0.88)",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}>
                                {artist.artistName.toUpperCase()}
                              </span>

                              {/* Genre */}
                              <span style={{
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: "5px",
                                color: "rgba(29,185,84,0.4)",
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                textTransform: "uppercase",
                              }}>
                                {artist.genres[0] ?? "—"}
                              </span>

                              {/* Followers */}
                              <span style={{
                                fontFamily: "'Press Start 2P', monospace",
                                fontSize: "6px",
                                color: "rgba(29,185,84,0.6)",
                              }}>
                                {formatFollowers(artist.followers)}
                              </span>

                              {/* Spotify link */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {artist.spotifyUrl && (
                                  <a href={artist.spotifyUrl} target="_blank" rel="noopener noreferrer"
                                    title={`Open ${artist.artistName} on Spotify`}
                                    style={{
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      width: "20px", height: "20px", borderRadius: "50%",
                                      border: `1px solid ${isHovered ? GREEN : "rgba(29,185,84,0.18)"}`,
                                      background: isHovered ? "rgba(29,185,84,0.14)" : "transparent",
                                      transition: "all 0.12s ease",
                                      boxShadow: isHovered ? `0 0 5px rgba(29,185,84,0.4)` : "none",
                                    }}>
                                    <svg width="9" height="9" viewBox="0 0 24 24"
                                      fill={isHovered ? GREEN : "rgba(29,185,84,0.38)"}
                                      style={{ transition: "fill 0.12s ease" }}>
                                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </div>
                {/* End leaderboard content */}
              </div>
              {/* End screen bezel */}
            </div>
            {/* End screen area */}

            {/* ── Right Side Panel ── */}
            <SidePanel side="right" />

          </div>
          {/* End body row */}

          {/* ════════════════════════════════════
              CONTROL PANEL
          ════════════════════════════════════ */}
          <div style={{
            background: `linear-gradient(180deg, ${CAB_MID} 0%, ${CAB_DARK} 100%)`,
            borderTop: `3px solid ${GREEN}`,
            padding: "12px 28px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}>
            {/* Left decorative buttons */}
            <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
              {[22, 16, 14].map((sz, i) => (
                <div key={i} style={{
                  width: sz, height: sz, borderRadius: "50%",
                  background: i === 0 ? GREEN : i === 1 ? "#15803d" : "#166534",
                  boxShadow: `0 0 ${i === 0 ? 10 : 6}px ${i === 0 ? GREEN : "#15803d"}88, inset 0 -2px 4px rgba(0,0,0,0.5)`,
                  border: "1.5px solid rgba(255,255,255,0.08)",
                }} />
              ))}
            </div>

            {/* Center: time range + coin slot */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              {/* Time range buttons */}
              <div style={{ display: "flex", gap: "6px" }}>
                {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([value, label]) => {
                  const active = timeRange === value;
                  return (
                    <button key={value} onClick={() => setTimeRange(value)} style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: "7px",
                      padding: "5px 9px",
                      background: active ? GREEN : "rgba(29,185,84,0.07)",
                      color: active ? "#000" : "rgba(29,185,84,0.55)",
                      border: `1px solid ${active ? GREEN : "rgba(29,185,84,0.22)"}`,
                      borderRadius: "3px",
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                      boxShadow: active ? `0 0 10px ${GREEN}55` : "none",
                      transition: "all 0.15s ease",
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Coin slot */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                <div style={{
                  width: "44px", height: "3px",
                  background: "rgba(29,185,84,0.25)", borderRadius: "2px",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)",
                }} />
                <span style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "5px",
                  color: "rgba(29,185,84,0.4)",
                  letterSpacing: "0.08em",
                  animation: "blinkCoin 2s ease-in-out infinite",
                }}>INSERT COIN</span>
              </div>
            </div>

            {/* Right decorative buttons */}
            <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
              {[14, 16, 22].map((sz, i) => (
                <div key={i} style={{
                  width: sz, height: sz, borderRadius: "50%",
                  background: i === 2 ? GREEN : i === 1 ? "#15803d" : "#166534",
                  boxShadow: `0 0 ${i === 2 ? 10 : 6}px ${i === 2 ? GREEN : "#15803d"}88, inset 0 -2px 4px rgba(0,0,0,0.5)`,
                  border: "1.5px solid rgba(255,255,255,0.08)",
                }} />
              ))}
            </div>
          </div>

          {/* ── Legs fill ── */}
          <div style={{
            background: `linear-gradient(180deg, ${CAB_DARK} 0%, #030804 100%)`,
            height: "72px",
            flexShrink: 0,
            borderTop: "1px solid rgba(29,185,84,0.1)",
          }} />

        </div>
        {/* End clip-path div */}
      </div>
      {/* End drop-shadow wrapper */}
    </div>
  );
}

// ── Side panel component ─────────────────────────────────────────────────────
function SidePanel({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <div style={{
      width: "58px",
      flexShrink: 0,
      background: isLeft
        ? `linear-gradient(to right, #040a05, #0d1f10, #0a1a0d)`
        : `linear-gradient(to left,  #040a05, #0d1f10, #0a1a0d)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-around",
      padding: "20px 0",
      borderLeft:  isLeft  ? "none" : `1px solid rgba(29,185,84,0.12)`,
      borderRight: isLeft  ? `1px solid rgba(29,185,84,0.12)` : "none",
      gap: "10px",
    }}>
      {/* Vertical LED strip */}
      <div style={{
        width: "3px",
        flex: 1,
        maxHeight: "80px",
        borderRadius: "2px",
        background: `linear-gradient(180deg, transparent, rgba(29,185,84,0.5), transparent)`,
        boxShadow: "0 0 6px rgba(29,185,84,0.3)",
      }} />

      {/* LED indicator dots */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: i % 2 === 0 ? "#1DB954" : "#15803d",
          animation: `ledPulse ${1.6 + i * 0.4}s ease-in-out infinite`,
          animationDelay: `${i * 0.3}s`,
        }} />
      ))}

      {/* Bottom LED strip */}
      <div style={{
        width: "3px",
        flex: 1,
        maxHeight: "80px",
        borderRadius: "2px",
        background: `linear-gradient(180deg, transparent, rgba(29,185,84,0.5), transparent)`,
        boxShadow: "0 0 6px rgba(29,185,84,0.3)",
      }} />
    </div>
  );
}
