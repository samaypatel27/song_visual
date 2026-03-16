"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

export interface VinylRecordProps {
    albumCoverUrl: string;
    position: [number, number, number];
    yRotation: number;
    scale: number;
    index: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISC GEOMETRY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TOTAL_R = 2.2;
const HALF_H = 0.055 / 2;         // 0.0275
const ART_R = 0.96 * TOTAL_R;    // 2.112 — leaves 4% dark rim
const ART_Z = HALF_H + 0.003;    // 0.0305
const DETAIL_Z = HALF_H + 0.006;    // 0.0335
const HOLE_Z = HALF_H + 0.008;    // 0.0355

const GROOVE_RADII = Array.from(
    { length: 8 },
    (_, i) => 0.15 * TOTAL_R + (i / 7) * (0.93 * TOTAL_R - 0.15 * TOTAL_R)
);

const IDLE_SPEED = (Math.PI * 2) / 15;
const HOVER_SPEED = (Math.PI * 2) / 1.5;

export function VinylRecord({
    albumCoverUrl,
    position,
    yRotation,
    scale,
    index,
}: VinylRecordProps) {
    // ── Diagnostic (Step 6) ─────────────────────────────────────────────────
    useEffect(() => {
        if (!albumCoverUrl) {
            console.warn("[VinylRecord] albumCoverUrl is falsy — disc will render blank:", albumCoverUrl);
        } else {
            console.log("[VinylRecord] albumCoverUrl received:", albumCoverUrl.slice(0, 60) + "...");
        }
    }, [albumCoverUrl]);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const groupRef = useRef<Group>(null);
    const basePosition = useRef<[number, number, number]>(position);
    const baseYRotation = useRef(yRotation);
    const isHovered = useRef(false);
    const currentSpinSpeed = useRef(IDLE_SPEED);
    const spinAngle = useRef(0);

    // ── Texture (THREE.TextureLoader + crossOrigin — NOT useTexture) ──────────
    // Spotify CDN (i.scdn.co) requires crossOrigin='anonymous' for WebGL textures.
    // useTexture from @react-three/drei does NOT set crossOrigin for external URLs,
    // which causes a silent black-face failure. TextureLoader is used manually.
    const [albumTexture, setAlbumTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!albumCoverUrl) return;

        const loader = new THREE.TextureLoader();
        loader.crossOrigin = "anonymous";

        const tex = loader.load(
            albumCoverUrl,
            (t) => {
                // SUCCESS callback
                t.colorSpace = THREE.SRGBColorSpace;
                t.minFilter = THREE.LinearMipmapLinearFilter;
                t.magFilter = THREE.LinearFilter;
                t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
                t.repeat.set(1, 1);
                t.offset.set(0, 0);
                t.needsUpdate = true;
                console.log("[VinylRecord] texture load SUCCESS", t, "image:", t.image);
                setAlbumTexture(t);
            },
            undefined,
            (err) => {
                // ERROR callback — CORS failure or 404 will appear here
                console.error("[VinylRecord] texture load FAILED", err, "url:", albumCoverUrl);
            }
        );

        return () => { tex.dispose(); setAlbumTexture(null); };
    }, [albumCoverUrl]);

    // ── Animation ─────────────────────────────────────────────────────────────
    useFrame(({ clock }, delta) => {
        if (!groupRef.current) return;
        const t = clock.elapsedTime;
        const phase = index * 1.618;

        const targetSpeed = isHovered.current ? HOVER_SPEED : IDLE_SPEED;
        currentSpinSpeed.current = THREE.MathUtils.lerp(currentSpinSpeed.current, targetSpeed, 0.06);
        spinAngle.current += currentSpinSpeed.current * delta;

        groupRef.current.rotation.y = baseYRotation.current + spinAngle.current;
        groupRef.current.position.y = basePosition.current[1] + Math.sin(t * ((Math.PI * 2) / 4) + phase) * 0.12;
        groupRef.current.rotation.x = Math.sin(t * ((Math.PI * 2) / 6) + phase + 1.3) * 0.052;
    });

    // ── Pointer handlers ──────────────────────────────────────────────────────
    const onPointerOver = () => { isHovered.current = true; document.body.style.cursor = "pointer"; };
    const onPointerOut = () => { isHovered.current = false; document.body.style.cursor = "default"; };

    return (
        <group ref={groupRef} position={position} rotation={[0, yRotation, 0]} scale={scale}>

            {/*
        ── SLEEVE — kept in code, not rendered per spec ───────────────────────
        <mesh position={[-0.9, 0, -0.04]} rotation={[0, Math.PI*(15/180), 0]}>
          <boxGeometry args={[2.4, 2.4, 0.02]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      */}

            {/* ── MAIN VINYL CYLINDER ─────────────────────────────────────────── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
                <cylinderGeometry args={[TOTAL_R, TOTAL_R, 0.055, 128]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.18} metalness={0.75} />
            </mesh>

            {/* ── FRONT FACE ────────────────────────────────────────────────────── */}

            {/* Art disc — front.
          key={albumTexture?.uuid} forces a full material remount when the texture
          loads — bypasses R3F's in-place patch which skips material.needsUpdate=true.
          Without this, the dark fallback material never gets replaced visually. */}
            <mesh position={[0, 0, ART_Z]} rotation={[-Math.PI / 2, 0, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
                <cylinderGeometry args={[ART_R, ART_R, 0.002, 128]} />
                <meshStandardMaterial
                    key={albumTexture?.uuid ?? "art-front-loading"}
                    map={albumTexture ?? undefined}
                    color={albumTexture ? "#ffffff" : "#1a1a2e"}
                    roughness={0.3}
                    metalness={albumTexture ? 0.05 : 0}
                />
            </mesh>

            {/* Groove rings — 8 semi-transparent over art */}
            {GROOVE_RADII.map((r, i) => (
                <mesh key={`gf-${i}`} position={[0, 0, DETAIL_Z]}>
                    <torusGeometry args={[r, 0.012, 6, 128]} />
                    <meshStandardMaterial color="#000000" opacity={0.18} transparent roughness={0.1} metalness={0.95} />
                </mesh>
            ))}

            {/* Iridescent shimmer ring */}
            <mesh position={[0, 0, DETAIL_Z]}>
                <torusGeometry args={[0.55 * TOTAL_R, 0.008, 4, 128]} />
                <meshStandardMaterial color="#3a3a6a" opacity={0.35} transparent roughness={0.02} metalness={1.0} />
            </mesh>

            {/* Spindle collar — front */}
            <mesh position={[0, 0, DETAIL_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.07 * TOTAL_R, 0.07 * TOTAL_R, 0.002, 32]} />
                <meshStandardMaterial color="#111111" roughness={0.3} />
            </mesh>

            {/* Center spindle hole — front */}
            <mesh position={[0, 0, HOLE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04 * TOTAL_R, 0.04 * TOTAL_R, 0.01, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* ── BACK FACE ─────────────────────────────────────────────────────── */}

            {/* Art disc — back.
          Same key-based remount fix as front disc. */}
            <mesh position={[0, 0, -ART_Z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[ART_R, ART_R, 0.002, 128]} />
                <meshStandardMaterial
                    key={albumTexture?.uuid ? albumTexture.uuid + "-back" : "art-back-loading"}
                    map={albumTexture ?? undefined}
                    color={albumTexture ? "#ffffff" : "#1a1a2e"}
                    roughness={0.3}
                    metalness={albumTexture ? 0.05 : 0}
                />
            </mesh>

            {/* Groove rings — back (4 rings) */}
            {GROOVE_RADII.filter((_, i) => i % 2 === 0).map((r, i) => (
                <mesh key={`gb-${i}`} position={[0, 0, -DETAIL_Z]}>
                    <torusGeometry args={[r, 0.012, 6, 128]} />
                    <meshStandardMaterial color="#000000" opacity={0.18} transparent roughness={0.1} metalness={0.95} />
                </mesh>
            ))}

            {/* Spindle collar — back */}
            <mesh position={[0, 0, -DETAIL_Z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.07 * TOTAL_R, 0.07 * TOTAL_R, 0.002, 32]} />
                <meshStandardMaterial color="#111111" roughness={0.3} />
            </mesh>

            {/* Center spindle hole — back */}
            <mesh position={[0, 0, -HOLE_Z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.04 * TOTAL_R, 0.04 * TOTAL_R, 0.01, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

        </group>
    );
}
