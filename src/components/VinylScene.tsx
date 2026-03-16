"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { VinylRecord } from "./VinylRecord";

// TYPES
interface Track {
  trackId: string;
  trackName: string;
  albumId: string;
  albumName: string;
  albumCoverUrl: string;
}

export interface AlbumGroup {
  albumId: string;
  albumName: string;
  albumCoverUrl: string;
  trackCount: number;
}

export interface VinylSceneProps {
  playlistId: string;
  pressedDirection: React.MutableRefObject<
    "up" | "down" | "left" | "right" | "reset" | null
  >;
}

const groupByAlbum = (tracks: Track[]): AlbumGroup[] => {
  const map = new Map<string, AlbumGroup>();
  tracks.forEach((track) => {
    if (map.has(track.albumId)) {
      map.get(track.albumId)!.trackCount += 1;
    } else {
      map.set(track.albumId, {
        albumId: track.albumId,
        albumName: track.albumName,
        albumCoverUrl: track.albumCoverUrl,
        trackCount: 1,
      });
    }
  });
  // Sort largest albums first — they'll get center placement
  return Array.from(map.values()).sort((a, b) => b.trackCount - a.trackCount);
};

export const getDiscRadius = (trackCount: number): number =>
  Math.min(1.8 + (trackCount - 1) * 0.45, 4.2);

/**
 * Place discs from largest → smallest.
 * Large discs (early indices) get a tight center zone; smaller discs expand
 * outward into the full scene. Overlap is prevented with radius-aware minimum
 * separation. Deterministic seeds → stable layout across renders.
 *
 * Scene visible bounds at fov=70, camera z=22: approx ±18x, ±10y.
 * 20% edge margin → usable: ±13x, ±7.2y.
 */
const generatePositions = (
  groups: AlbumGroup[],
): [number, number, number][] => {
  const positions: [number, number, number][] = [];
  const radii: number[] = [];
  const n = groups.length;
  const maxAttempts = 120;

  groups.forEach((group, i) => {
    const r = getDiscRadius(group.trackCount);
    // progress 0 = largest disc, 1 = smallest
    const progress = n <= 1 ? 0.5 : i / (n - 1);

    // Placement zone grows from center outward as discs get smaller.
    // Largest disc: ±5x, ±3y → smallest disc: ±13x, ±7.2y
    const xRange = 5 + progress * 8;
    const yRange = 3 + progress * 4.2;

    let placed = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seed = i * 1000 + attempt;
      // Map sin output [-1,1] → [0,1] then scale to placement zone
      const x = (Math.sin(seed * 127.1) * 0.5 + 0.5) * 2 * xRange - xRange;
      const y = (Math.sin(seed * 311.7) * 0.5 + 0.5) * 2 * yRange - yRange;
      const z = 0;

      // Enforce minimum gap = sum of both radii + 1.5 unit padding
      const tooClose = positions.some((pos, j) => {
        const dx = pos[0] - x;
        const dy = pos[1] - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < radii[j] + r + 1.5;
      });

      if (!tooClose) {
        positions.push([x, y, z]);
        radii.push(r);
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Fallback: overlap-aware spiral — expand outward until a clear spot is found
      const baseAngle = i * 2.399; // golden angle keeps starting directions spread out
      let spiralDist = r * 2;
      outer: while (spiralDist < 80) {
        for (let a = 0; a < Math.PI * 2; a += 0.25) {
          const fx = Math.cos(baseAngle + a) * spiralDist;
          const fy = Math.sin(baseAngle + a) * spiralDist;
          const tooClose = positions.some((pos, j) => {
            const dx = pos[0] - fx;
            const dy = pos[1] - fy;
            return Math.sqrt(dx * dx + dy * dy) < radii[j] + r + 0.5;
          });
          if (!tooClose) {
            positions.push([fx, fy, 0]);
            radii.push(r);
            placed = true;
            break outer;
          }
        }
        spiralDist += r * 0.8;
      }
      if (!placed) {
        // Absolute last resort — push far out, accept potential overlap
        positions.push([Math.cos(i * 2.399) * 80, Math.sin(i * 2.399) * 80, 0]);
        radii.push(r);
        console.warn(`[VinylScene] "${group.albumName}" could not be placed without overlap`);
      }
    }
  });

  return positions;
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA CONTROLLER
// Reads pressedDirection ref each frame and adjusts the OrbitControls TARGET —
// NOT camera.position. This means OrbitControls retains full control of the
// camera matrix, so mouse/touchpad gestures work normally. The d-pad simply
// shifts where OrbitControls is "orbiting around".
// ─────────────────────────────────────────────────────────────────────────────
function CameraController({
  pressedDirection,
  controlsRef,
}: {
  pressedDirection: React.MutableRefObject<
    "up" | "down" | "left" | "right" | "reset" | null
  >;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const ORIGIN = new THREE.Vector3(0, 0, 0);

  useFrame(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const dir = pressedDirection.current;
    const speed = 0.25;

    if (dir === "up") {
      ctrl.target.y += speed;
    }
    if (dir === "down") {
      ctrl.target.y -= speed;
    }
    if (dir === "left") {
      ctrl.target.x -= speed;
    }
    if (dir === "right") {
      ctrl.target.x += speed;
    }
    if (dir === "reset") {
      ctrl.target.lerp(ORIGIN, 0.12);
    }

    // Clamp target so user can't pan completely off all discs
    ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -12, 12);
    ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -8, 8);

    // Required after manually mutating target
    if (dir) ctrl.update();
  });

  return null;
}

// VinylScene
export function VinylScene({ playlistId, pressedDirection }: VinylSceneProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    if (!playlistId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/spotify/playlist-tracks/${playlistId}`);
        if (!res.ok) throw new Error(String(res.status));
        const data: { tracks: Track[] } = await res.json();
        const groups = groupByAlbum(data.tracks);
        console.log(`[VinylScene] ${groups.length} albums, ${data.tracks.length} tracks`);
        setTracks(data.tracks);
      } catch (err) {
        console.error("[VinylScene] fetch error:", err);
      }
    };
    void load();
  }, [playlistId]);

  // groupByAlbum already sorts largest → smallest
  const albumGroups = useMemo(() => groupByAlbum(tracks), [tracks]);
  const positions = useMemo(
    () => generatePositions(albumGroups),
    [albumGroups],
  );

  return (
    <Canvas
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        background: "transparent",
        pointerEvents: "auto",
      }}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: 70, position: [0, 0, 22], near: 0.1, far: 200 }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[0, 5, 15]} intensity={0.6} color="#fff8f0" />
      {/* wall fill */}
      <pointLight position={[6, 6, 8]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-6, -4, 3]} intensity={0.5} color="#3a3aff" />
      <pointLight position={[0, 0, -10]} intensity={0.2} color="#ff8844" />

      {/*
        OrbitControls — restores full mouse/touchpad navigation.
        enableDamping gives smooth deceleration after gestures.
        The d-pad adjusts controls.target (via CameraController) rather than
        camera.position, so both input methods coexist without conflict.
      */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        enableZoom
        enablePan
        panSpeed={0.8}
        zoomSpeed={0.8}
        minDistance={8}
        maxDistance={50}
        makeDefault
      />

      {/* D-pad integration — reads pressedDirection, adjusts OrbitControls target */}
      <CameraController
        pressedDirection={pressedDirection}
        controlsRef={controlsRef}
      />

      {/* One disc per unique album, sorted largest → smallest (centre → outskirts) */}
      {albumGroups.map((group, i) => (
        <VinylRecord
          key={group.albumId}
          albumCoverUrl={group.albumCoverUrl}
          position={positions[i] ?? [0, 0, 0]}
          radius={getDiscRadius(group.trackCount)}
        />
      ))}

      {/* WALL — customize color/texture/material here  */}
      <mesh position={[0, 0, -3]}>
        <planeGeometry args={[120, 70]} />
        <meshStandardMaterial
          color="#eeebe7"
          roughness={0.85}
          metalness={0.0}
        />
      </mesh>
    </Canvas>
  );
}
