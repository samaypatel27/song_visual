"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";

export interface CrateTrack {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumCoverUrl: string;
  rank: number;
  recentPlayCount: number;
}

interface VinylCrateProps {
  label: string;
  tracks: CrateTrack[];
  position: [number, number, number];
}

// ── Geometry constants ─────────────────────────────────────────────────────────
const CW = 3.2;    // crate width
const CH = 2.8;    // crate height
const CD = 2.4;    // crate depth
const WALL = 0.12; // panel thickness

const HALF_W = CW / 2;  // 1.6
const HALF_H = CH / 2;  // 1.4
const HALF_D = CD / 2;  // 1.2

// Sleeve dimensions
const SW = 1.4;   // sleeve width
const SH = 1.6;   // sleeve height
const SD = 0.06;  // sleeve depth (thin)

// Sleeve standing center Y in local crate space:
//   crate top rim = HALF_H = 1.4
//   0.5 units peek above → sleeve top = 1.4 + 0.5 = 1.9
//   sleeve center = 1.9 - SH/2 = 1.9 - 0.8 = 1.1
const STANDING_Y = 1.1;

// Tabletop surface in local crate coordinates = bottom of crate interior
const TABLETOP_LOCAL_Y = -HALF_H;   // = -1.4
const FAN_Y = TABLETOP_LOCAL_Y + 0.03;

// Sleeve Z-axis spread in local space (along crate depth):
//   interior Z: from (-HALF_D + WALL + SD/2) to (HALF_D - WALL - SD/2)
//   = (-1.2 + 0.12 + 0.03) to (1.2 - 0.12 - 0.03) = -1.05 to 1.05
const SLEEVE_Z_MIN = -1.05;
const SLEEVE_Z_MAX = 1.05;

// ── Per-sleeve animation state (mutated in useFrame, never triggers re-render) ──
interface SleeveState {
  px: number; py: number; pz: number;
  rx: number; rz: number;
  hoverLift: number;
  hoverTarget: number;
}

// ── Inner component — uses useTexture (requires Suspense boundary above) ───────
function VinylCrateInner({ label, tracks, position }: VinylCrateProps) {
  const n = tracks.length;

  // ── Textures ──────────────────────────────────────────────────────────────
  // Fallback URL prevents empty-array error from useTexture
  const urls = useMemo(() => tracks.map((t) => t.albumCoverUrl), [tracks]);
  const fallback = "/Wall_Background.png";
  const rawTex = useTexture(urls.length > 0 ? urls : [fallback]);
  const textures: THREE.Texture[] = useMemo(() => {
    const arr = Array.isArray(rawTex) ? rawTex : [rawTex];
    arr.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; });
    return arr;
  }, [rawTex]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const sleeveGroupRefs = useRef<(THREE.Group | null)[]>([]);

  // ── Fan state ─────────────────────────────────────────────────────────────
  const [isFanned, setIsFanned] = useState(false);
  const isFannedRef = useRef(false);
  const isFannedPrev = useRef(false);
  isFannedRef.current = isFanned;

  const fanClickElapsed = useRef(0); // clock.elapsedTime when fan was toggled

  // Hover index — needs re-render for Html tooltip
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // ── Sleeve targets (stable) ────────────────────────────────────────────────
  const spread = n > 1 ? (SLEEVE_Z_MAX - SLEEVE_Z_MIN) / (n - 1) : 0;

  const standingTargets = useMemo(() =>
    Array.from({ length: n }, (_, i) => ({
      px: 0,
      py: STANDING_Y,
      pz: n > 1 ? SLEEVE_Z_MIN + i * spread : 0,
      rx: 0,
      rz: Math.sin(i * 31.7) * 0.08,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );

  const fanTargets = useMemo(() =>
    Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI; // 0 → π across all sleeves
      const radius = 2.8 + i * 0.15;
      return {
        px: Math.cos(angle) * radius,
        py: FAN_Y,
        pz: Math.sin(angle) * radius,
        rx: -Math.PI / 2,
        rz: Math.sin(i * 22.3) * 0.15,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [n]
  );

  // ── Animation state ref — initial values match standingTargets ────────────
  const sleeveState = useRef<SleeveState[]>(
    Array.from({ length: n }, (_, i) => ({
      px: 0,
      py: STANDING_Y,
      pz: n > 1 ? SLEEVE_Z_MIN + i * spread : 0,
      rx: 0,
      rz: Math.sin(i * 31.7) * 0.08,
      hoverLift: 0,
      hoverTarget: 0,
    }))
  );

  // ── Materials (stable instances) ────────────────────────────────────────────
  const woodMat = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: "#8B6914", roughness: 0.85, metalness: 0.0 }),
    []
  );
  const slatMat = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: "#6B4F10", roughness: 0.9, metalness: 0.0 }),
    []
  );
  const paperMat = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: "#f5f0e8", roughness: 0.9, metalness: 0.0 }),
    []
  );
  const sleeveBodyMat = useMemo(() =>
    new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.7, metalness: 0.0 }),
    []
  );

  // ── useFrame — sleeve animation ───────────────────────────────────────────
  useFrame(({ clock }) => {
    // First frame after fan state change: snapshot elapsed time for stagger
    if (isFannedRef.current !== isFannedPrev.current) {
      fanClickElapsed.current = clock.elapsedTime;
      isFannedPrev.current = isFannedRef.current;
    }

    const timeSinceFlip = clock.elapsedTime - fanClickElapsed.current;
    const fanned = isFannedRef.current;

    sleeveState.current.forEach((s, i) => {
      const ref = sleeveGroupRefs.current[i];
      if (!ref) return;

      // Stagger: each sleeve waits index * 40 ms before lerping
      const lerpFactor = timeSinceFlip >= i * 0.04 ? 0.08 : 0;

      const tgt = fanned ? fanTargets[i] : standingTargets[i];
      const hoverLiftTarget = fanned ? s.hoverTarget : 0;

      s.hoverLift = THREE.MathUtils.lerp(s.hoverLift, hoverLiftTarget, 0.12);
      s.px = THREE.MathUtils.lerp(s.px, tgt.px, lerpFactor);
      s.py = THREE.MathUtils.lerp(s.py, tgt.py + s.hoverLift, lerpFactor);
      s.pz = THREE.MathUtils.lerp(s.pz, tgt.pz, lerpFactor);
      s.rx = THREE.MathUtils.lerp(s.rx, tgt.rx, lerpFactor);
      s.rz = THREE.MathUtils.lerp(s.rz, tgt.rz, lerpFactor);

      ref.position.set(s.px, s.py, s.pz);
      ref.rotation.x = s.rx;
      ref.rotation.z = s.rz;
    });
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCrateClick = (e: any) => {
    e.stopPropagation();
    if (isFannedRef.current) setHoveredIdx(null);
    setIsFanned((v) => !v);
  };

  const handleSleeveClick = async (track: CrateTrack, e: any) => {
    e.stopPropagation();
    if (!isFannedRef.current) return;
    try {
      await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.trackId }),
      });
    } catch (err) {
      console.error("[VinylCrate] play error:", err);
    }
  };

  // ── Slat Y positions — 3 per face, evenly spaced ──────────────────────────
  const slatYs: number[] = [-HALF_H * 0.55, 0, HALF_H * 0.55];

  return (
    <group position={position}>
      {/* ── Crate body panels (5 — open top) ──────────────────────────────── */}

      {/* Bottom panel */}
      <mesh
        position={[0, -HALF_H + WALL / 2, 0]}
        material={woodMat}
        onClick={handleCrateClick}
      >
        <boxGeometry args={[CW, WALL, CD]} />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-HALF_W + WALL / 2, 0, 0]}
        material={woodMat}
        onClick={handleCrateClick}
      >
        <boxGeometry args={[WALL, CH, CD]} />
      </mesh>
      {/* Left slats — on outer face (-X side) */}
      {slatYs.map((y, si) => (
        <mesh
          key={`ls-${si}`}
          position={[-HALF_W - 0.01, y, 0]}
          material={slatMat}
        >
          <boxGeometry args={[0.02, 0.08, CD - 0.06]} />
        </mesh>
      ))}

      {/* Right wall */}
      <mesh
        position={[HALF_W - WALL / 2, 0, 0]}
        material={woodMat}
        onClick={handleCrateClick}
      >
        <boxGeometry args={[WALL, CH, CD]} />
      </mesh>
      {/* Right slats */}
      {slatYs.map((y, si) => (
        <mesh
          key={`rs-${si}`}
          position={[HALF_W + 0.01, y, 0]}
          material={slatMat}
        >
          <boxGeometry args={[0.02, 0.08, CD - 0.06]} />
        </mesh>
      ))}

      {/* Front wall */}
      <mesh
        position={[0, 0, HALF_D - WALL / 2]}
        material={woodMat}
        onClick={handleCrateClick}
      >
        <boxGeometry args={[CW, CH, WALL]} />
      </mesh>
      {/* Front slats — on outer face (+Z side) */}
      {slatYs.map((y, si) => (
        <mesh
          key={`fws-${si}`}
          position={[0, y, HALF_D + 0.01]}
          material={slatMat}
        >
          <boxGeometry args={[CW - 0.06, 0.08, 0.02]} />
        </mesh>
      ))}
      {/* Label card on front face */}
      <mesh position={[0, 0, HALF_D + 0.07]} material={paperMat}>
        <boxGeometry args={[1.8, 0.5, 0.02]} />
      </mesh>
      <Text
        position={[0, 0, HALF_D + 0.11]}
        fontSize={0.14}
        color="#2a1f0e"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.6}
        font="https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIWpZA.woff2"
      >
        {label}
      </Text>

      {/* Back wall */}
      <mesh
        position={[0, 0, -HALF_D + WALL / 2]}
        material={woodMat}
        onClick={handleCrateClick}
      >
        <boxGeometry args={[CW, CH, WALL]} />
      </mesh>

      {/* ── Record sleeves ─────────────────────────────────────────────────── */}
      {tracks.map((track, i) => {
        const tex = urls.length > 0 ? textures[i] : undefined;
        const isHoveredFanned = isFanned && hoveredIdx === i;

        return (
          <group
            key={track.trackId}
            ref={(el) => { sleeveGroupRefs.current[i] = el; }}
          >
            {/* Sleeve body — dark back/sides */}
            <mesh
              material={sleeveBodyMat}
              onClick={(e) => handleSleeveClick(track, e)}
              onPointerOver={(e) => {
                e.stopPropagation();
                if (!isFannedRef.current) return;
                sleeveState.current[i].hoverTarget = 0.15;
                setHoveredIdx(i);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                sleeveState.current[i].hoverTarget = 0;
                setHoveredIdx(null);
                document.body.style.cursor = "default";
              }}
            >
              <boxGeometry args={[SW, SH, SD]} />
            </mesh>

            {/* Album art — overlaid on front face (+Z) */}
            {tex && (
              <mesh position={[0, 0, SD / 2 + 0.001]}>
                <planeGeometry args={[SW, SH]} />
                <meshBasicMaterial map={tex} />
              </mesh>
            )}

            {/* Tooltip — only when this sleeve is hovered while fanned */}
            {isHoveredFanned && (
              <Html position={[0, SH / 2 + 0.25, 0]} center distanceFactor={8}>
                <div
                  style={{
                    background: "rgba(0,0,0,0.82)",
                    color: "#e8d5b0",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    whiteSpace: "nowrap",
                    fontFamily: "Inter, sans-serif",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{track.trackName}</div>
                  <div style={{ opacity: 0.75, fontSize: "12px" }}>{track.artistName}</div>
                  <div style={{ opacity: 0.5, fontSize: "11px" }}>{track.albumName}</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ── Public export — wraps inner in Suspense so useTexture can suspend ─────────
export function VinylCrate(props: VinylCrateProps) {
  return (
    <Suspense fallback={null}>
      <VinylCrateInner {...props} />
    </Suspense>
  );
}
