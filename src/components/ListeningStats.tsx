"use client";

import { useEffect, useState } from "react";

interface AudioFeatures {
  danceability: number;
  energy: number;
  valence: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
  liveness: number;
  tempo: number;
}

interface ListeningStatsData {
  audioFeatures: AudioFeatures;
  genreSeeds: string[];
  trackCount: number;
}

const FEATURE_META: {
  key: keyof Omit<AudioFeatures, "tempo">;
  label: string;
  description: string;
  color: string;
}[] = [
  { key: "energy",           label: "Energy",           description: "Intensity and activity level",        color: "#FF4D4D" },
  { key: "danceability",     label: "Danceability",     description: "How suitable for dancing",            color: "#1DB954" },
  { key: "valence",          label: "Positivity",       description: "Musical positiveness / happiness",    color: "#FFD700" },
  { key: "acousticness",     label: "Acousticness",     description: "Confidence the track is acoustic",    color: "#7EB8F7" },
  { key: "instrumentalness", label: "Instrumentalness", description: "Predicts absence of vocals",          color: "#B97EF7" },
  { key: "liveness",         label: "Liveness",         description: "Presence of live audience",           color: "#F7A07E" },
  { key: "speechiness",      label: "Speechiness",      description: "Presence of spoken words",            color: "#7EF7D4" },
];

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.07)", borderRadius: "3px", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: `${Math.round(value * 100)}%`,
          background: color,
          borderRadius: "3px",
          transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ height: "48px", margin: "6px 0", borderRadius: "8px", background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite", opacity: 1 - i * 0.08 }} />
      ))}
    </div>
  );
}

export function ListeningStats() {
  const [data, setData] = useState<ListeningStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/spotify/listening-stats")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "#0a0a0f",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 24px 80px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ width: "100%", maxWidth: "900px", marginBottom: "36px" }}>
        <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: "22px", fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: 0, letterSpacing: "-0.01em" }}>
          Listening Profile
        </h2>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>
          {loading ? "Analysing your top tracks…" : `Averaged across ${data?.trackCount ?? 0} top tracks`}
        </p>
      </div>

      {loading ? <Skeleton /> : data && (
        <>
          {/* Audio features grid */}
          <div
            style={{
              width: "100%",
              maxWidth: "900px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "12px",
              marginBottom: "48px",
            }}
          >
            {FEATURE_META.map(({ key, label, description, color }) => {
              const value = data.audioFeatures[key];
              return (
                <div
                  key={key}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "12px",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                    <div>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                        {label}
                      </span>
                      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>
                        {description}
                      </p>
                    </div>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "15px", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(value * 100)}
                    </span>
                  </div>
                  <Bar value={value} color={color} />
                </div>
              );
            })}

            {/* Tempo card — displayed separately since it's BPM not 0-1 */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Tempo</span>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: "2px 0 8px" }}>Average BPM of top tracks</p>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "28px", fontWeight: 700, color: "#F7C97E", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(data.audioFeatures.tempo)}
                <span style={{ fontSize: "13px", fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>BPM</span>
              </span>
            </div>
          </div>

          {/* Genre seeds */}
          <div style={{ width: "100%", maxWidth: "900px" }}>
            <h3 style={{ fontFamily: "Inter, sans-serif", fontSize: "15px", fontWeight: 600, color: "rgba(255,255,255,0.55)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Available Genre Seeds
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.genreSeeds.map((genre) => (
                <span
                  key={genre}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.55)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "9999px",
                    padding: "4px 12px",
                    textTransform: "capitalize",
                    letterSpacing: "0.02em",
                  }}
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </>
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
