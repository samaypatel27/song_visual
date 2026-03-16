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
// PLACEMENT — Grid with deterministic organic jitter (Issue 2)
//
// Replaces the golden-angle spiral.  A wider-than-tall grid ensures every disc
// has clear breathing room (5.5 u horizontal, 5.0 u vertical).  The jitter is
// computed from sin/cos of magic numbers — deterministic (same every render)
// and bounded (never causes overlap at 50+ discs).
// ─────────────────────────────────────────────────────────────────────────────
function getPosition(index: number, total: number): [number, number, number] {
    const cols = Math.ceil(Math.sqrt(total * 1.6)); // wider than tall
    const col = index % cols;
    const row = Math.floor(index / cols);

    const spacingX = 5.5;
    const spacingY = 5.0;
    const totalCols = cols;
    const totalRows = Math.ceil(total / cols);
    const offsetX = ((totalCols - 1) * spacingX) / 2;
    const offsetY = ((totalRows - 1) * spacingY) / 2;

    // Bounded deterministic jitter — never causes overlap
    const jitterX = (Math.sin(index * 127.1) * 0.5 + Math.cos(index * 311.7) * 0.3) * 1.2;
    const jitterY = (Math.sin(index * 269.5) * 0.5 + Math.cos(index * 183.3) * 0.3) * 1.0;
    const jitterZ = (Math.sin(index * 74.3) * 0.5) * 1.5; // depth variation

    return [
        col * spacingX - offsetX + jitterX,
        -(row * spacingY - offsetY) + jitterY,
        jitterZ,
    ];
}

// Subtle Y rotation — not flat-on and not edge-on (±10° max)
function getYRotation(index: number): number {
    return Math.sin(index * 45.3) * 0.18;
}

// Minor scale variety so rows don't look uniform
function getScale(index: number): number {
    return 0.9 + (index % 3) * 0.05;
}

// ─────────────────────────────────────────────────────────────────────────────
// VinylScene
//
// Layer order:
//   z-index: 0 — GLSL shader (ShaderBackground, separate canvas)
//   z-index: 1 — This R3F canvas (transparent background)
//
// Camera pulled back to z=22 with fov=70 to fit the full grid (even at 50+
// discs the widest extent is ~cols/2 * 5.5 + jitter ≈ 24 u at 50 tracks).
// autoRotate gives a slow passive orbit so users see the spread over time.
// ─────────────────────────────────────────────────────────────────────────────
export function VinylScene({ playlistId }: VinylSceneProps) {
    const [tracks, setTracks] = useState<Track[]>([]);

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
                // Step 5 diagnostic: split by whether cover URL is present
                const withCover = data.tracks.filter((t: Track) => !!t.albumCoverUrl);
                const withoutCover = data.tracks.filter((t: Track) => !t.albumCoverUrl);
                console.log("[VinylScene] raw API response length:", data.tracks.length);
                console.log(`[VinylScene] tracks WITH albumCoverUrl: ${withCover.length}`);
                console.log(`[VinylScene] tracks WITHOUT albumCoverUrl: ${withoutCover.length}`);
                if (withoutCover.length > 0) {
                    console.warn("[VinylScene] tracks missing cover:", withoutCover.map((t: Track) => t.trackName));
                }
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
            // Camera at z=22, fov=70 — fits a 50-disc grid without clipping
            camera={{ fov: 70, position: [0, 0, 22], near: 0.1, far: 200 }}
        >
            {/* ── Lighting ──────────────────────────────────────────────────────── */}

            {/* Ambient fill at 0.6 — below 0.5 unlit disc sides appear pitch black */}
            <ambientLight intensity={0.6} />

            {/* Main warm white key light */}
            <pointLight position={[6, 6, 8]} intensity={1.4} color="#ffffff" />

            {/* Blue-purple fill — creates iridescent shimmer on metalness=1 rings,
          matches the Spotify-green GLSL shader palette complementarily */}
            <pointLight position={[-6, -4, 3]} intensity={0.5} color="#3a3aff" />

            {/* Subtle warm rim light from behind — separates discs from bg */}
            <pointLight position={[0, 0, -10]} intensity={0.2} color="#ff8844" />

            {/* ── Camera controls ───────────────────────────────────────────────── */}
            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.15}
            />

            {/* ── One disc per track — empty canvas while loading ─────────────── */}
            {tracks.map((track, i) => (
                <VinylRecord
                    key={track.trackId + i}
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
