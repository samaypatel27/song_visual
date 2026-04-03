// Hall of Fame — /hall-of-fame
//
// Layer order (z-index):
//   0 — GLSL shader background   (ShaderBackground, position:fixed)
//   1 — 3D scene                 (HallOfFameScene, transparent R3F Canvas, position:fixed)
//  10 — D-pad navigation         (DPadControls, position:fixed, bottom-right)
//  50 — Back button pill         (position:fixed, bottom-left)

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
// import { ShaderBackground } from "@/components/ShaderBackground";
import { HallOfFameScene } from "@/components/HallOfFameScene";
import { DPadControls } from "@/components/DPadControls";

type Direction = "up" | "down" | "left" | "right" | "reset";

export default function HallOfFamePage() {
  const router = useRouter();
  const pressedDirection = useRef<Direction | null>(null);

  return (
    <>
      {/* Layer 0 — animated GLSL background (commented out — wall texture used instead) */}
      {/* <ShaderBackground /> */}

      {/* Layer 1 — 3D plaque wall + vinyl crates, transparent canvas */}
      <HallOfFameScene pressedDirection={pressedDirection} />

      {/* Layer 10 — D-pad for camera pan (pan down to reveal crate row) */}
      <DPadControls pressedDirection={pressedDirection} />

      {/* Layer 50 — back button pill, bottom-left */}
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
    </>
  );
}
