// Hall of Fame — /hall-of-fame
//
// Layout (two scroll sections):
//   Section 1 (sticky, 200vh scroll space):
//     CircularGallery — top albums carousel (scroll to rotate)
//   Section 2 (100vh):
//     HallOfFameScene — 3D artist plaques + vinyl crates
//
// Fixed overlays (position:fixed, always on top):
//   z=20 — D-pad navigation (bottom-right)
//   z=50 — Back button pill (bottom-left)

"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HallOfFameScene } from "@/components/HallOfFameScene";
import { DPadControls } from "@/components/DPadControls";
import { CircularGallery, type GalleryItem } from "@/components/ui/circular-gallery";

type Direction = "up" | "down" | "left" | "right" | "reset";

export default function HallOfFamePage() {
  const router = useRouter();
  const pressedDirection = useRef<Direction | null>(null);
  const [albums, setAlbums] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  useEffect(() => {
    fetch("/api/spotify/top-albums")
      .then((r) => {
        if (!r.ok) throw new Error(`top-albums ${r.status}`);
        return r.json();
      })
      .then((data) => setAlbums(data.albums ?? []))
      .catch((err) => console.error("[HallOfFamePage] top-albums fetch error:", err))
      .finally(() => setGalleryLoading(false));
  }, []);

  return (
    <div style={{ position: "relative" }}>

      {/* ── Section 1: Circular Album Gallery ─────────────────────────────────
          200vh of scrollable space with a sticky 100vh viewport.
          Scrolling this section rotates the carousel.
      ───────────────────────────────────────────────────────────────────── */}
      <section style={{ height: "200vh" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            background: "#0a0a0f",
          }}
        >
          {/* Title overlay */}
          <div
            style={{
              position: "absolute",
              top: "8%",
              left: 0,
              right: 0,
              textAlign: "center",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <h1
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 700,
                color: "rgba(255,255,255,0.95)",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Hall of Fame
            </h1>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                color: "rgba(255,255,255,0.45)",
                marginTop: "6px",
              }}
            >
              {galleryLoading ? "Loading your top albums…" : "Your all-time top albums · Scroll to rotate"}
            </p>
          </div>

          {/* Circular Gallery */}
          {!galleryLoading && albums.length > 0 && (
            <CircularGallery
              items={albums}
              radius={500}
              autoRotateSpeed={0.015}
              style={{ position: "absolute", inset: 0 }}
            />
          )}

          {/* Scroll hint arrow at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: "5%",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              color: "rgba(255,255,255,0.35)",
              fontFamily: "Inter, sans-serif",
              fontSize: "12px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span>Scroll</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Section 2: 3D Hall of Fame Scene ──────────────────────────────────
          Artist plaques + vinyl crates in a Three.js canvas.
          HallOfFameScene now uses position:absolute within its own wrapper.
      ───────────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", height: "100vh" }}>
        <HallOfFameScene pressedDirection={pressedDirection} />
      </section>

      {/* ── Fixed overlays ─────────────────────────────────────────────────── */}

      {/* D-pad: only useful in Section 2 (3D scene panning) */}
      <DPadControls pressedDirection={pressedDirection} />

      {/* Back button pill */}
      <button
        onClick={() => router.push("/dashboard")}
        style={{
          position: "fixed",
          bottom: "28px",
          left: "28px",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "9999px",
          color: "rgba(255,255,255,0.9)",
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "background 0.2s ease, border-color 0.2s ease",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.4)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>
    </div>
  );
}
