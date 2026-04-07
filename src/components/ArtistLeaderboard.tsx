"use client";

import { useEffect, useState } from "react";

interface ArtistData {
  artistId: string;
  artistName: string;
  artistImageUrl: string;
  rank: number;
  genres: string[];
  followers: number;
  popularity: number;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

export function ArtistLeaderboard() {
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spotify/top-artists")
      .then((r) => r.json())
      .then((d) => setArtists(d.artists ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", maxWidth: "780px", marginBottom: "20px" }}>
        <h2
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "22px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Top Artists
        </h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>
          Last 4 weeks
        </p>
      </div>

      {/* Column headers */}
      <div
        style={{
          width: "100%",
          maxWidth: "780px",
          display: "grid",
          gridTemplateColumns: "40px 44px 1fr 120px 80px 60px",
          gap: "0 16px",
          padding: "6px 16px",
          boxSizing: "border-box",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          marginBottom: "4px",
        }}
      >
        {["#", "", "Artist", "Genre", "Followers", "Pop."].map((h) => (
          <span
            key={h}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ width: "100%", maxWidth: "780px" }}>
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: "56px",
                  margin: "3px 0",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.04)",
                  animation: "pulse 1.5s ease-in-out infinite",
                  opacity: 1 - i * 0.07,
                }}
              />
            ))
          : artists.map((artist) => {
              const isHovered = hoveredId === artist.artistId;
              const rankColor = RANK_COLORS[artist.rank] ?? "rgba(255,255,255,0.45)";
              const popPercent = artist.popularity;

              return (
                <div
                  key={artist.artistId}
                  onMouseEnter={() => setHoveredId(artist.artistId)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 44px 1fr 120px 80px 60px",
                    gap: "0 16px",
                    alignItems: "center",
                    padding: "0 16px",
                    height: "56px",
                    margin: "3px 0",
                    borderRadius: "8px",
                    background: isHovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                    borderLeft: isHovered ? `2px solid ${rankColor}` : "2px solid transparent",
                    cursor: "default",
                    transition: "background 0.15s ease, border-color 0.15s ease",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Rank */}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: rankColor,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {artist.rank}
                  </span>

                  {/* Avatar */}
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: `1.5px solid ${isHovered ? rankColor : "rgba(255,255,255,0.1)"}`,
                      flexShrink: 0,
                      transition: "border-color 0.15s ease",
                    }}
                  >
                    {artist.artistImageUrl ? (
                      <img
                        src={artist.artistImageUrl}
                        alt={artist.artistName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.1)" }} />
                    )}
                  </div>

                  {/* Name */}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: isHovered ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.85)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {artist.artistName}
                  </span>

                  {/* Genre */}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.4)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textTransform: "capitalize",
                    }}
                  >
                    {artist.genres[0] ?? "—"}
                  </span>

                  {/* Followers */}
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      color: "rgba(255,255,255,0.55)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatFollowers(artist.followers)}
                  </span>

                  {/* Popularity bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div
                      style={{
                        flex: 1,
                        height: "3px",
                        borderRadius: "2px",
                        background: "rgba(255,255,255,0.1)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${popPercent}%`,
                          height: "100%",
                          borderRadius: "2px",
                          background: isHovered ? "#1DB954" : "rgba(255,255,255,0.35)",
                          transition: "background 0.15s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
