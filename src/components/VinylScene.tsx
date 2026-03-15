"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { VinylRecord } from "./VinylRecord";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Track {
    trackId: string;
    trackName: string;
    albumId: string;
    albumName: string;
    albumCoverUrl: string;
}

interface VinylSceneProps {
    playlistId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENT ALGORITHM — Golden-angle spiral
//
// The golden angle (~137.5°) is the same packing found in sunflower seeds:
// it distributes any number of items evenly across space with no repetitive
// patterns, regardless of count.  Combined with increasing radius, the result
// is an organic spread that never forms a grid.
// ─────────────────────────────────────────────────────────────────────────────
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399 rad ≈ 137.5°

function getPosition(index: number, total: number): [number, number, number] {
    const radius = 2.5 + (index / total) * 5.5;
    const theta = index * GOLDEN_ANGLE;
    const x = Math.cos(theta) * radius * 1.6;
    const y = Math.sin(theta) * radius * 0.85;
    const z = -((index % 5) * 0.6);
    return [x, y, z];
}

function getYRotation(index: number): number {
    return (index * 37.5 * Math.PI) / 180;
}

function getScale(index: number): number {
    return 0.9 + (index % 3) * 0.08;
}

// ─────────────────────────────────────────────────────────────────────────────
// VINYL SCENE
//
// Canvas layers:
//   z-index: 0 — GLSL ShaderBackground (separate canvas, not in this component)
//   z-index: 1 — This R3F Canvas (transparent, shows shader through)
//
// gl.alpha = true + no <color> attachment = transparent canvas bg.
// Camera at (0, 0, 14) with fov 75 gives enough FOV to see the full spiral
// even with 50+ discs spread to radius ≈ 8 × 1.6 = 12.8 in X.
// ─────────────────────────────────────────────────────────────────────────────
export function VinylScene({ playlistId }: VinylSceneProps) {
    const [tracks, setTracks] = useState<Track[]>([]);

    // Fetch all tracks for this playlist from our server-side proxy
    useEffect(() => {
        if (!playlistId) return;
        fetch(`/api/spotify/playlist-tracks/${playlistId}`)
            .then((res) => {
                if (!res.ok) throw new Error(`${res.status}`);
                return res.json();
            })
            .then((data: { tracks: Track[] }) => {
                console.log("HERE ARE ALL THE SONGS:");
                data.tracks.forEach((track: Track, i: number) => {
                    console.log(`  ${i + 1}. ${track.trackName}`);
                });
                setTracks(data.tracks);
            })
            .catch((err) => console.error("[VinylScene] fetch error:", err));
    }, [playlistId]);

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
            camera={{ fov: 75, position: [0, 0, 14], near: 0.1, far: 200 }}
        >
            {/* ── Lighting ──────────────────────────────────────────────────── */}

            {/* Soft ambient fill */}
            <ambientLight intensity={0.3} />

            {/* Main white key light (shadows disabled — not needed for this scene) */}
            <pointLight
                position={[5, 5, 5]}
                intensity={1.2}
                color="#ffffff"
            />

            {/* Blue-purple fill — matches the shader background palette and
          creates iridescent shimmer on the metalness=1 shimmer rings */}
            <pointLight position={[-5, -3, 2]} intensity={0.4} color="#3a3aff" />

            {/* ── Camera controls ───────────────────────────────────────────── */}
            {/*
        autoRotate gives a slow passive camera orbit so users see the full
        spiral spread over time without needing to interact.
        Zoom and pan are disabled to keep the experience focused.
      */}
            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.25}
            />

            {/* ── One disc per track — renders nothing while loading (tracks=[]) ─ */}
            {tracks.map((track, i) => (
                <VinylRecord
                    key={track.trackId + i} // append index so duplicate trackIds are safe
                    albumCoverUrl={track.albumCoverUrl}
                    position={getPosition(i, tracks.length)}
                    yRotation={getYRotation(i)}
                    scale={getScale(i)}
                    index={i}
                />
            ))}
        </Canvas>
    );
}
