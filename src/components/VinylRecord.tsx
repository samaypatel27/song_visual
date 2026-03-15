"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface VinylRecordProps {
    albumCoverUrl: string;                // Spotify CDN image URL
    position: [number, number, number];
    yRotation: number;               // radians
    scale: number;
    index: number;               // used to offset sine phase
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// 12 groove rings evenly spaced between r = 0.44 and r = 0.96
const GROOVE_RADII = Array.from(
    { length: 12 },
    (_, i) => 0.44 + (i / 11) * (0.96 - 0.44)
);

// The main disc cylinder (height 0.045) is rotated so its face points toward
// the camera (+Z). With rotation.x = -PI/2 the "bottom" face (local y = -0.0225)
// ends up at world z = +0.0225.  Everything layered on top of that face goes at
// z > 0.0225.  We use LAYER_Z as a convenient offset above the disc surface.
const HALF_HEIGHT = 0.045 / 2;   // = 0.0225
const LAYER_Z = HALF_HEIGHT + 0.002; // = 0.0245

// ─────────────────────────────────────────────────────────────────────────────
// VINYL RECORD COMPONENT
//
// Sleeve code is preserved below in a commented block (kept per spec) but not
// mounted in the scene.
//
// Disc orientation:
//   • Main cylinder rotation.x = -PI/2  → flat face toward +Z (camera)
//   • discSpinRef wraps all disc content and rotates around Z each frame
//     → appears as face-on record spin from the camera's perspective
// ─────────────────────────────────────────────────────────────────────────────
export function VinylRecord({
    albumCoverUrl,
    position,
    yRotation,
    scale,
    index,
}: VinylRecordProps) {
    // ── Refs ──────────────────────────────────────────────────────────────────
    const groupRef = useRef<Group>(null);
    const discSpinRef = useRef<Group>(null);
    const isHovered = useRef(false);
    const spinSpeed = useRef(0.004);

    // ── Album art texture (loaded imperatively to control crossOrigin) ─────────
    const [albumTexture, setAlbumTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!albumCoverUrl) return;

        const loader = new THREE.TextureLoader();
        // Spotify's CDN supports CORS — anonymous is required for WebGL textures.
        loader.crossOrigin = "anonymous";

        const tex = loader.load(albumCoverUrl, (t) => {
            t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
            t.repeat.set(1, 1);
            t.offset.set(0, 0);
            t.needsUpdate = true;
            setAlbumTexture(t);
        });

        return () => {
            tex.dispose();
            setAlbumTexture(null);
        };
    }, [albumCoverUrl]);

    // ── Per-frame animation ───────────────────────────────────────────────────
    useFrame((state) => {
        if (!groupRef.current || !discSpinRef.current) return;
        const t = state.clock.elapsedTime;

        // Lerp spin speed toward target (slow on hover, normal otherwise)
        const targetSpeed = isHovered.current ? 0.001 : 0.004;
        spinSpeed.current += (targetSpeed - spinSpeed.current) * 0.05;
        discSpinRef.current.rotation.z += spinSpeed.current;

        // Floating bob — accumulates in tiny per-frame increments (bounded by sin)
        groupRef.current.position.y +=
            Math.sin(t * 0.6 + index * 1.618) * 0.0006;

        // Very subtle Y-axis sway
        groupRef.current.rotation.y =
            yRotation + Math.sin(t * 0.18 + index * 0.9) * 0.04;

        // Hover scale — lerp to 1.15× or back to 1.0×
        const targetScale = isHovered.current ? 1.15 : 1.0;
        groupRef.current.scale.lerp(
            new THREE.Vector3(targetScale, targetScale, targetScale),
            0.08
        );
    });

    // ── Pointer handlers ──────────────────────────────────────────────────────
    const handlePointerOver = () => {
        isHovered.current = true;
        document.body.style.cursor = "pointer";
    };
    const handlePointerOut = () => {
        isHovered.current = false;
        document.body.style.cursor = "default";
    };

    return (
        <group ref={groupRef} position={position} rotation={[0, yRotation, 0]} scale={scale}>

            {/*
        ── SLEEVE (kept in code, not rendered) ────────────────────────────────
        Spec: "keep the sleeve/black square component in code but not rendered".

        <mesh position={[-0.9, 0, -0.04]} rotation={[0, Math.PI * (15/180), 0]} castShadow>
          <boxGeometry args={[2.4, 2.4, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
        <mesh position={[-0.9, 0, 0]} rotation={[0, Math.PI * (15/180), 0]} castShadow>
          <boxGeometry args={[2.2, 2.2, 0.05]} />
          <meshStandardMaterial color="#000000" roughness={0.8} />
        </mesh>
        ── END SLEEVE ──────────────────────────────────────────────────────────
      */}

            {/* ── DISC SYSTEM ──────────────────────────────────────────────────── */}
            {/*
        discSpinRef rotates around Z every frame.
        All disc children are parented here, so they all spin together.
      */}
            <group ref={discSpinRef}>

                {/* Main vinyl body — dark glossy disc */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    castShadow
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                >
                    <cylinderGeometry args={[1.0, 1.0, 0.045, 128]} />
                    <meshStandardMaterial color="#0a0a0a" roughness={0.18} metalness={0.75} />
                </mesh>

                {/* 12 groove rings — outer vinyl area (r 0.44 → 0.96) */}
                {GROOVE_RADII.map((r, i) => (
                    <mesh key={`groove-${i}`} position={[0, 0, LAYER_Z]}>
                        <torusGeometry args={[r, 0.0035, 4, 128]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.9} />
                    </mesh>
                ))}

                {/* Shimmer ring — catches the blue-purple fill light */}
                <mesh position={[0, 0, LAYER_Z]}>
                    <torusGeometry args={[0.7, 0.012, 4, 128]} />
                    <meshStandardMaterial color="#2a2a4a" roughness={0.05} metalness={1.0} />
                </mesh>

                {/* Album art label disc (r = 0.42) — sits at centre of record */}
                <mesh position={[0, 0, LAYER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.42, 0.42, 0.001, 64]} />
                    <meshStandardMaterial
                        map={albumTexture ?? undefined}
                        color={albumTexture ? "#ffffff" : "#1c1c2e"} // dark fallback while loading
                        roughness={0.4}
                        metalness={0}
                    />
                </mesh>

                {/* Center hole — pure black disc punches a visual hole through the label */}
                <mesh position={[0, 0, LAYER_Z + 0.002]} rotation={[-Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.072, 0.072, 0.1, 16]} />
                    <meshBasicMaterial color="#000000" />
                </mesh>

            </group>

        </group>
    );
}
