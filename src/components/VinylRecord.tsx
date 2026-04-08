"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

export interface VinylRecordProps {
    albumCoverUrl: string;
    position: [number, number, number];
    radius: number; // dynamic — set by VinylScene based on track count
    spinEnabledRef?: React.RefObject<boolean>; // when false, external group drives rotation
}

// ── Animation speeds ───────────────────────────────────────────────────────
const IDLE_SPEED = (Math.PI * 2) / 30;   // 1 full rotation per 30 s
const HOVER_SPEED = (Math.PI * 2) / 2;   // 1 full rotation per 2 s on hover

// Groove ring radii as a fraction of disc radius (outer zone only, matching AlbumCover)
const GROOVE_FRACS = [0.977, 0.932, 0.886, 0.841, 0.795, 0.750, 0.705, 0.659];

export function VinylRecord({ albumCoverUrl, position, radius, spinEnabledRef }: VinylRecordProps) {

    // ── Z-layer offsets ────────────────────────────────────────────────────
    const HALF_H   = 0.055 / 2;
    const ART_Z    = HALF_H + 0.003;
    const DETAIL_Z = HALF_H + 0.006;
    const HOLE_Z   = HALF_H + 0.008;

    // ── Refs ────────────────────────────────────────────────────────────────
    const groupRef = useRef<Group>(null);
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

    // ── Animation — face-on Z-axis spin ───────────────────────────────────
    useFrame(({}, delta) => {
        if (!groupRef.current) return;
        if (spinEnabledRef?.current === false) return;
        const targetSpeed = isHovered.current ? HOVER_SPEED : IDLE_SPEED;
        currentSpinSpeed.current = THREE.MathUtils.lerp(currentSpinSpeed.current, targetSpeed, 0.06);
        spinAngle.current += currentSpinSpeed.current * delta;
        groupRef.current.rotation.z = spinAngle.current;
    });

    // ── Pointer ───────────────────────────────────────────────────────────────
    const onPointerOver = () => { isHovered.current = true; document.body.style.cursor = "pointer"; };
    const onPointerOut = () => { isHovered.current = false; document.body.style.cursor = "default"; };

    return (
        <group ref={groupRef} position={position}>

            {/* ── MAIN VINYL CYLINDER ──────────────────────────────────────────── */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
                <cylinderGeometry args={[radius, radius, 0.055, 64]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.15} metalness={0.8} />
            </mesh>

            {/* ── FRONT FACE ───────────────────────────────────────────────────── */}

            {/* Art disc — circleGeometry + meshBasicMaterial (lighting-immune, full coverage) */}
            <mesh position={[0, 0, ART_Z]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
                <circleGeometry args={[radius, 64]} />
                <meshBasicMaterial
                    key={albumTexture?.uuid ?? "art-loading"}
                    map={albumTexture ?? undefined}
                    color={albumTexture ? "#ffffff" : "#1a1a2e"}
                />
            </mesh>

            {/* Groove rings — outer zone only, matching AlbumCover proportions */}
            {GROOVE_FRACS.map((frac, i) => (
                <mesh key={`gf-${i}`} position={[0, 0, DETAIL_Z]}>
                    <torusGeometry args={[radius * frac, radius * 0.0045, 4, 80]} />
                    <meshBasicMaterial color="#000000" opacity={0.32} transparent />
                </mesh>
            ))}

            {/* Label border ring — chrome outline */}
            <mesh position={[0, 0, DETAIL_Z]}>
                <torusGeometry args={[radius * 0.443, radius * 0.014, 6, 80]} />
                <meshBasicMaterial color="#c8c8c8" transparent opacity={0.85} />
            </mesh>

            {/* Label area tint */}
            <mesh position={[0, 0, ART_Z]}>
                <circleGeometry args={[radius * 0.432, 48]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.18} />
            </mesh>

            {/* Inner label ring */}
            <mesh position={[0, 0, DETAIL_Z]}>
                <torusGeometry args={[radius * 0.375, radius * 0.007, 4, 80]} />
                <meshBasicMaterial color="#aaaaaa" transparent opacity={0.55} />
            </mesh>

            {/* Spindle hole */}
            <mesh position={[0, 0, HOLE_Z]}>
                <circleGeometry args={[radius * 0.125, 24]} />
                <meshBasicMaterial color="#060606" />
            </mesh>

            {/* Spindle chrome rim */}
            <mesh position={[0, 0, DETAIL_Z]}>
                <torusGeometry args={[radius * 0.127, radius * 0.009, 4, 32]} />
                <meshBasicMaterial color="#bbbbbb" transparent opacity={0.7} />
            </mesh>

        </group>
    );
}
