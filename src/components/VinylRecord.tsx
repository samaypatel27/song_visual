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

// 15 groove rings, evenly spaced from radius*0.18 to radius*0.96
const GROOVE_COUNT = 15;
const GROOVE_FRACS = Array.from({ length: GROOVE_COUNT }, (_, i) =>
    0.18 + (i / (GROOVE_COUNT - 1)) * (0.96 - 0.18)
);

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

    // ── Center label CanvasTexture ─────────────────────────────────────────
    const [labelTexture, setLabelTexture] = useState<THREE.CanvasTexture | null>(null);

    useEffect(() => {
        if (!albumCoverUrl) return;
        let cancelled = false;

        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (cancelled) return;
            const SIZE = 256;
            const canvas = document.createElement("canvas");
            canvas.width = SIZE;
            canvas.height = SIZE;
            const ctx = canvas.getContext("2d")!;
            ctx.beginPath();
            ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, 0, 0, SIZE, SIZE);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            setLabelTexture(tex);
        };
        img.onerror = (e) => console.error("[VinylRecord] label img load FAILED", e);
        img.src = albumCoverUrl;

        return () => {
            cancelled = true;
            setLabelTexture(prev => {
                prev?.dispose();
                return null;
            });
        };
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
                <meshStandardMaterial color="#0a0a0a" roughness={0.08} metalness={0.7} />
            </mesh>

            {/* ── FRONT FACE ───────────────────────────────────────────────────── */}

            {/* Groove rings — 15 rings across full disc face */}
            {GROOVE_FRACS.map((frac, i) => (
                <mesh key={`gf-${i}`} position={[0, 0, DETAIL_Z]}>
                    <torusGeometry args={[radius * frac, radius * 0.003, 4, 80]} />
                    <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.02} />
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

            {/* Center label — circular album art at radius * 0.28 */}
            <mesh position={[0, 0, ART_Z]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
                <circleGeometry args={[radius * 0.28, 48]} />
                <meshStandardMaterial
                    key={labelTexture?.uuid ?? "label-loading"}
                    map={labelTexture ?? undefined}
                    color={labelTexture ? "#ffffff" : "#1a1a2e"}
                    roughness={0.4}
                    metalness={0.1}
                />
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
