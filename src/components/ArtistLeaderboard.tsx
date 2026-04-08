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
  short_term: "Last 4 Weeks",
  medium_term: "Last 6 Months",
  long_term: "Last 12 Months",
};

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
  const [timeRange, setTimeRange] = useState<TimeRange>("short_term");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/spotify/top-artists?time_range=${timeRange}`)
      .then((r) => r.json())
      .then((d) => setArtists(d.artists ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [timeRange]);

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
      <div style={{ width: "100%", maxWidth: "780px", marginBottom: "20px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
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
            {TIME_RANGE_LABELS[timeRange]}
          </p>
        </div>

        {/* Time range dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "rgba(255,255,255,0.75)",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
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
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: "160px",
                background: "rgba(20,20,28,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                overflow: "hidden",
                zIndex: 100,
                backdropFilter: "blur(12px)",
              }}
            >
              {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setTimeRange(value); setDropdownOpen(false); }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px 16px",
                    textAlign: "left",
                    background: timeRange === value ? "rgba(29,185,84,0.15)" : "transparent",
                    border: "none",
                    color: timeRange === value ? "#1DB954" : "rgba(255,255,255,0.7)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    fontWeight: timeRange === value ? 600 : 400,
                    cursor: "pointer",
                    transition: "background 0.1s ease",
                  }}
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
        {(["#", "", "Artist", "Genre", "Followers", ""] as const).map((h, i) => (
          <span
            key={i}
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
                      <Image
                        src={artist.artistImageUrl}
                        alt={artist.artistName}
                        width={36}
                        height={36}
                        style={{ objectFit: "cover", width: "100%", height: "100%" }}
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

                  {/* Spotify link */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {artist.spotifyUrl && (
                      <a
                        href={artist.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open ${artist.artistName} on Spotify`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background: isHovered ? "rgba(29,185,84,0.15)" : "transparent",
                          border: `1px solid ${isHovered ? "rgba(29,185,84,0.4)" : "rgba(255,255,255,0.1)"}`,
                          transition: "background 0.15s ease, border-color 0.15s ease",
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(29,185,84,0.25)";
                          e.currentTarget.style.borderColor = "#1DB954";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isHovered ? "rgba(29,185,84,0.15)" : "transparent";
                          e.currentTarget.style.borderColor = isHovered ? "rgba(29,185,84,0.4)" : "rgba(255,255,255,0.1)";
                        }}
                      >
                        {/* Spotify logo mark */}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={isHovered ? "#1DB954" : "rgba(255,255,255,0.4)"} style={{ transition: "fill 0.15s ease" }}>
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                        </svg>
                      </a>
                    )}
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
