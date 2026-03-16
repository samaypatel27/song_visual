"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

export interface VinylRecordProps {
    albumCoverUrl: string;
    position: [number, number, number];
    yRotation: number;
    index: number;
    radius: number; // dynamic — set by VinylScene based on track count
}

// ── Animation speeds ───────────────────────────────────────────────────────
const IDLE_SPEED = (Math.PI * 2) / 15;
const HOVER_SPEED = (Math.PI * 2) / 1.5;

export function VinylRecord({ albumCoverUrl, position, yRotation, index, radius }: VinylRecordProps) {

    // ── All geometry sizes derived from `radius` prop ──────────────────────────
    const HALF_H = 0.055 / 2;
    const ART_R = radius * 0.96;
    const ART_Z = HALF_H + 0.003;
    const DETAIL_Z = HALF_H + 0.006;
    const HOLE_Z = HALF_H + 0.008;

    const GROOVE_RADII = Array.from(
        { length: 8 },
        (_, i) => radius * 0.15 + (i / 7) * (radius * 0.93 - radius * 0.15)
    );

    // ── Refs ────────────────────────────────────────────────────────────────
    const groupRef = useRef<Group>(null);
    const basePosition = useRef<[number, number, number]>(position);
    const baseYRotation = useRef(yRotation);
    const isHovered = useRef(false);
    const currentSpinSpeed = useRef(IDLE_SPEED);
    const spinAngle = useRef(0);

    // ── Texture ─────────────────────────────────────────────────────────────
    const [albumTexture, setAlbumTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!albumCoverUrl) return;
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = "anonymous";
        const tex = loader.load(
            albumCoverUrl,
            (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                t.minFilter = THREE.LinearMipmapLinearFilter;
                t.magFilter = THREE.LinearFilter;
                t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
                t.repeat.set(1, 1);
                t.offset.set(0, 0);
                t.rotation = Math.PI / 2;   // correct 90° UV offset from CylinderGeometry caps
                t.center.set(0.5, 0.5);
                t.needsUpdate = true;
                setAlbumTexture(t);
            },
            undefined,
            (err) => console.error("[VinylRecord] texture load FAILED", err)
        );
        return () => { tex.dispose(); setAlbumTexture(null); };
    }, [albumCoverUrl]);

    // ── Animation ────────────────────────────────────────────────────────────
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

    // ── Pointer ───────────────────────────────────────────────────────────────
    const onPointerOver = () => { isHovered.current = true; document.body.style.cursor = "pointer"; };
    const onPointerOut = () => { isHovered.current = false; document.body.style.cursor = "default"; };

    return (
        <group ref={groupRef} position={position} rotation={[0, yRotation, 0]}>

            {/* ── MAIN VINYL CYLINDER ──────────────────────────────────────────── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
                <cylinderGeometry args={[radius, radius, 0.055, 128]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.18} metalness={0.75} />
            </mesh>

            {/* ── FRONT FACE ───────────────────────────────────────────────────── */}

            {/* Art disc — key forces material remount when texture UUID changes */}
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

            {/* Groove rings — 8 semi-transparent concentric rings over art */}
            {GROOVE_RADII.map((r, i) => (
                <mesh key={`gf-${i}`} position={[0, 0, DETAIL_Z]}>
                    <torusGeometry args={[r, radius * 0.005, 6, 128]} />
                    <meshStandardMaterial color="#000000" opacity={0.18} transparent roughness={0.1} metalness={0.95} />
                </mesh>
            ))}

            {/* Iridescent shimmer ring */}
            <mesh position={[0, 0, DETAIL_Z]}>
                <torusGeometry args={[radius * 0.55, radius * 0.004, 4, 128]} />
                <meshStandardMaterial color="#3a3a6a" opacity={0.35} transparent roughness={0.02} metalness={1.0} />
            </mesh>

            {/* Spindle collar — front */}
            <mesh position={[0, 0, DETAIL_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[radius * 0.07, radius * 0.07, 0.002, 32]} />
                <meshStandardMaterial color="#111111" roughness={0.3} />
            </mesh>

            {/* Center hole — front */}
            <mesh position={[0, 0, HOLE_Z]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[radius * 0.04, radius * 0.04, 0.01, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* ── BACK FACE ──────────────────────────────────────────────────────── */}

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

            {GROOVE_RADII.filter((_, i) => i % 2 === 0).map((r, i) => (
                <mesh key={`gb-${i}`} position={[0, 0, -DETAIL_Z]}>
                    <torusGeometry args={[r, radius * 0.005, 6, 128]} />
                    <meshStandardMaterial color="#000000" opacity={0.18} transparent roughness={0.1} metalness={0.95} />
                </mesh>
            ))}

            <mesh position={[0, 0, -DETAIL_Z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[radius * 0.07, radius * 0.07, 0.002, 32]} />
                <meshStandardMaterial color="#111111" roughness={0.3} />
            </mesh>

            <mesh position={[0, 0, -HOLE_Z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[radius * 0.04, radius * 0.04, 0.01, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

        </group>
    );
}
