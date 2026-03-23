"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { VinylRecord } from "./VinylRecord";
import { AlbumCover } from "./AlbumCover";

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

// Card size helper (same as AlbumCover)

const WALL_WIDTH = 120;
const WALL_HEIGHT = 70;
const getCardSize = (trackCount: number) => Math.min(1.8 + (trackCount - 1) * 0.45, 4.2) * 2;

// Original golden spiral layout for vinyl discs (restored)
const generatePositions = (groups: AlbumGroup[]) => {
  const positions = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const wallClamp = (x: number, y: number) => [
    Math.max(-WALL_WIDTH / 2 + 2, Math.min(WALL_WIDTH / 2 - 2, x)),
    Math.max(-WALL_HEIGHT / 2 + 2, Math.min(WALL_HEIGHT / 2 - 2, y)),
  ];
  for (let i = 0; i < groups.length; i++) {
    const radius = 18 * Math.sqrt(i + 0.5) / Math.sqrt(groups.length);
    const angle = i * goldenAngle;
    let x = radius * Math.cos(angle);
    let y = radius * Math.sin(angle);
    [x, y] = wallClamp(x, y);
    const yRotation = (Math.random() - 0.5) * 0.5;
    const scale = 1.1 + (Math.random() - 0.5) * 0.12;
    positions.push({ x, y, angle, yRotation, scale });
    // eslint-disable-next-line no-console
    console.log(`AlbumCover #${i}: x=${x.toFixed(2)}, y=${y.toFixed(2)}, angle=${angle.toFixed(2)}, yRot=${yRotation.toFixed(2)}, scale=${scale.toFixed(2)}`);
  }
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
      dpr={[1, 2]}
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
        enableRotate = {false}
        screenSpacePanning = {true}
        mouseButtons={
            {
                LEFT: THREE.MOUSE.PAN, 
                MIDDLE: THREE.MOUSE.DOLLY, 
                RIGHT: THREE.MOUSE.ROTATE
            }
        }
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
      {albumGroups.map((group, i) => {
        const { x, y, angle, yRotation, scale } = positions[i] || { x: 0, y: 0, angle: 0, yRotation: 0, scale: 1 };
        return (
          <group
            key={group.albumId}
            position={[x, y, 0.1]}
            rotation={[0, yRotation, angle]}
            scale={scale}
          >
            <AlbumCover
              albumCoverUrl={group.albumCoverUrl}
              position={[0, 0, 0]}
              trackCount={group.trackCount}
              index={i}
              scale={scale}
            />
          </group>
        );
      })}

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
