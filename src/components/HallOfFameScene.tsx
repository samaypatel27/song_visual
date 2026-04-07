"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { ArtistPlaque } from "./ArtistPlaque";
import { VinylCrate, type CrateTrack } from "./VinylCrate";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ArtistData {
  artistId: string;
  artistName: string;
  artistImageUrl: string;
  rank: number;
}

interface TopTrack {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumCoverUrl: string;
  rank: number;
  recentPlayCount: number;
  albumId: string;
}

interface CrateData {
  label: string;
  tracks: CrateTrack[];
}

type Direction = "up" | "down" | "left" | "right" | "reset" | null;

// ── Crate mood assignment ─────────────────────────────────────────────────────
const CRATE_ORDER = ["Can't Stop", "Right Now", "Deep Cuts", "Discovering"] as const;

function buildCrates(tracks: TopTrack[]): CrateData[] {
  const map = new Map<string, CrateTrack[]>([
    ["Can't Stop", []],
    ["Right Now", []],
    ["Deep Cuts", []],
    ["Discovering", []],
  ]);

  for (const t of tracks) {
    let label: string;
    if (t.recentPlayCount >= 4) label = "Can't Stop";
    else if (t.rank <= 10) label = "Right Now";
    else if (t.rank <= 30) label = "Deep Cuts";
    else label = "Discovering";

    const arr = map.get(label)!;
    if (arr.length < 12) arr.push(t);
  }

  return CRATE_ORDER
    .map((label) => ({ label, tracks: map.get(label)! }))
    .filter((c) => c.tracks.length > 0);
}

// ── Scene constants ───────────────────────────────────────────────────────────
// Tabletop world Y — matches RecordPlayer placement in VinylScene (~y=-23).
// Crates sit here; camera pans down to reveal them.
const TABLETOP_Y = -20;
const CRATE_HEIGHT = 2.8;
const CRATE_CENTER_Y = TABLETOP_Y + CRATE_HEIGHT / 2; // = -18.6
const PLAQUE_SPACING = 4.7;   // bumped from 4.0 — plaques are now 4.0 wide (WW)
const CRATE_SPACING = 4.0;

// ── Wall background — same asset and parameters as VinylScene ─────────────────
function WallBackground() {
  const tex = useTexture("/Wall_Background.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return (
    <mesh position={[0, 0, -3]}>
      <planeGeometry args={[120, 70]} />
      <meshStandardMaterial map={tex} roughness={0.85} metalness={0.0} />
    </mesh>
  );
}

// ── Camera controller — mirrors VinylScene's ZoomController pan logic ─────────
function CameraController({
  controlsRef,
  pressedDirection,
}: {
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  pressedDirection: React.MutableRefObject<Direction>;
}) {
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const dir = pressedDirection.current;
    const speed = 0.25;
    if (dir === "up") ctrl.target.y += speed;
    if (dir === "down") ctrl.target.y -= speed;
    if (dir === "left") ctrl.target.x -= speed;
    if (dir === "right") ctrl.target.x += speed;
    if (dir === "reset") ctrl.target.lerp(ORIGIN, 0.12);
    // Extended downward limit (−14) so tabletop crates at y≈−18.6 are clearly visible
    ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -12, 12);
    ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -14, 8);
    if (dir) ctrl.update();
  });
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface HallOfFameSceneProps {
  pressedDirection: React.MutableRefObject<Direction>;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function HallOfFameScene({ pressedDirection }: HallOfFameSceneProps) {
  const [artists, setArtists] = useState<ArtistData[]>([]);
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // ── Parallel fetch — top-artists + top-tracks ─────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/spotify/top-artists").then((r) => {
        if (!r.ok) throw new Error(`top-artists ${r.status}`);
        return r.json();
      }),
      fetch("/api/spotify/top-tracks").then((r) => {
        if (!r.ok) throw new Error(`top-tracks ${r.status}`);
        return r.json();
      }),
    ])
      .then(([artistData, trackData]) => {
        setArtists(artistData.artists ?? []);
        setTracks(trackData.tracks ?? []);
      })
      .catch((err) => console.error("[HallOfFameScene] fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  // ── Crate data — derived from tracks ─────────────────────────────────────
  const crateData = useMemo(() => buildCrates(tracks), [tracks]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "transparent",
          pointerEvents: "auto",
        }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ fov: 70, position: [0, 0, 22], near: 0.1, far: 200 }}
      >
        {/* Lighting — increased ambient so plaques are clearly visible */}
        <ambientLight intensity={0.65} />
        <pointLight position={[0, 8, 4]} intensity={2.0} color="#fff5e0" />
        <pointLight position={[-8, 2, 3]} intensity={0.8} color="#4040ff" />
        <pointLight position={[8, 2, 3]} intensity={0.8} color="#4040ff" />
        {/* Warm fill for tabletop area */}
        <pointLight position={[0, -12, 6]} intensity={0.7} color="#fff5e0" />

        {/* OrbitControls — pan only, no rotation (mirrors VinylScene setup) */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          enableZoom
          enablePan
          enableRotate={false}
          minAzimuthAngle={0}
          maxAzimuthAngle={0}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          screenSpacePanning
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
          panSpeed={0.8}
          zoomSpeed={0.8}
          minDistance={3}
          maxDistance={50}
          makeDefault
        />
        <CameraController controlsRef={controlsRef} pressedDirection={pressedDirection} />

        {/* Artist plaque row — y = 0.5, centered at x = 0 (Scaled up 1.8x overall) */}
        <group scale={1.8}>
          {artists.map((artist, i) => {
            const x = -((artists.length - 1) / 2) * PLAQUE_SPACING + i * PLAQUE_SPACING;
            const y = 0.5;
            const z = Math.sin(i * 0.8) * 0.3;
            const rotZ = Math.sin(i * 23.4) * 0.04;
            return (
              <ArtistPlaque
                key={artist.artistId}
                artistName={artist.artistName}
                artistImageUrl={artist.artistImageUrl}
                rank={artist.rank}
                position={[x, y, z]}
                rotationZ={rotZ}
              />
            );
          })}
        </group>

        {/* Vinyl crate row — sitting on tabletop below plaques */}
        {crateData.map((crate, i) => {
          const x = -((crateData.length - 1) / 2) * CRATE_SPACING + i * CRATE_SPACING;
          const z = Math.sin(i * 44.1) * 0.3; // slight front-back variation
          return (
            <VinylCrate
              key={crate.label}
              label={crate.label}
              tracks={crate.tracks}
              position={[x, CRATE_CENTER_Y, z]}
            />
          );
        })}

        {/* Wall — same texture/parameters as VinylScene */}
        <Suspense
          fallback={
            <mesh position={[0, 0, -3]}>
              <planeGeometry args={[120, 70]} />
              <meshStandardMaterial color="#eeebe7" roughness={0.85} metalness={0.0} />
            </mesh>
          }
        >
          <WallBackground />
        </Suspense>
      </Canvas>

      {loading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            background: "rgba(0,0,0,0.6)",
            padding: "16px 28px",
            borderRadius: "12px",
            fontFamily: "Inter, sans-serif",
            fontSize: "15px",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          Loading Hall of Fame...
        </div>
      )}
    </div>
  );
}
