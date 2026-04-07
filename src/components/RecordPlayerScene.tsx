"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VinylRecord } from "@/components/VinylRecord";

// ── Knurling ring Y positions ──────────────────────────────────────────────
const KNURL_COUNT = 8;
const KNURL_YS = Array.from({ length: KNURL_COUNT }, (_, i) =>
    -0.12 + (i / (KNURL_COUNT - 1)) * 0.24
);

// ── Tonearm curve (module-level, immutable) ────────────────────────────────
const ARM_CURVE = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.3, 0.65, -1.8),
    new THREE.Vector3(3.1, 0.65, -1.0),
    new THREE.Vector3(2.8, 0.65, -0.2),
    new THREE.Vector3(2.3, 0.65, 0.5),
]);
const ARM_GEO = new THREE.TubeGeometry(ARM_CURVE, 40, 0.04, 8, false);

// ── VU meter tick angles ───────────────────────────────────────────────────
const VU_TICK_ANGLES = Array.from({ length: 7 }, (_, i) =>
    -0.55 + (i / 6) * 1.1
);

// ── Sub-component: VU meter with animated needle ──────────────────────────
function VUMeter() {
    const needleRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (!needleRef.current) return;
        const t = clock.getElapsedTime();
        needleRef.current.rotation.y =
            Math.sin(t * 2.3) * 0.28 + Math.sin(t * 0.71) * 0.12;
    });

    return (
        <group position={[3.05, 0.32, 0]}>
            {/* Bezel */}
            <mesh>
                <boxGeometry args={[0.08, 0.06, 0.85]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
            </mesh>
            {/* Face plate — pale yellow */}
            <mesh position={[-0.045, 0.005, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.78, 0.05]} />
                <meshStandardMaterial color="#fffde8" roughness={0.7} metalness={0} />
            </mesh>
            {/* Needle — rotates at Y axis around its base */}
            <mesh ref={needleRef} position={[-0.05, 0.008, 0.05]} rotation={[0, 0, 0]}>
                <boxGeometry args={[0.002, 0.002, 0.28]} />
                <meshStandardMaterial color="#111111" roughness={0.3} />
            </mesh>
            {/* Scale ticks */}
            {VU_TICK_ANGLES.map((angle, i) => (
                <mesh
                    key={`tick-${i}`}
                    position={[
                        -0.045,
                        0.008,
                        Math.sin(angle) * 0.28,
                    ]}
                    rotation={[0, -angle, 0]}
                >
                    <boxGeometry args={[0.002, 0.002, 0.03]} />
                    <meshStandardMaterial color="#444444" roughness={0.4} />
                </mesh>
            ))}
        </group>
    );
}

// ── Sub-component: control knob with knurling ──────────────────────────────
function ControlKnob() {
    return (
        <group position={[3.2, 0.35, 1.8]}>
            {/* Main knob body */}
            <mesh>
                <cylinderGeometry args={[0.32, 0.36, 0.3, 32]} />
                <meshStandardMaterial color="#888888" metalness={0.75} roughness={0.25} />
            </mesh>
            {/* Knurling rings */}
            {KNURL_YS.map((y, i) => (
                <mesh key={`knurl-${i}`} position={[0, y, 0]}>
                    <torusGeometry args={[0.33, 0.025, 4, 32]} />
                    <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.4} />
                </mesh>
            ))}
            {/* Top cap / pointer */}
            <mesh position={[0, 0.175, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
                <meshStandardMaterial color="#555555" metalness={0.5} roughness={0.3} />
            </mesh>
        </group>
    );
}

// ── Sub-component: tonearm assembly ───────────────────────────────────────
function TonearmAssembly() {
    return (
        <group>
            {/* Pivot base */}
            <mesh position={[3.3, 0.35, -1.8]} castShadow>
                <cylinderGeometry args={[0.22, 0.28, 0.5, 32]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Pivot top cap (smaller, chrome) */}
            <mesh position={[3.3, 0.62, -1.8]}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.95} roughness={0.05} />
            </mesh>
            {/* Arm tube */}
            <mesh castShadow>
                <primitive object={ARM_GEO} />
                <meshStandardMaterial color="#d4d4d4" metalness={0.95} roughness={0.05} />
            </mesh>
            {/* Counterweight (behind pivot) */}
            <mesh position={[3.5, 0.65, -2.5]}>
                <cylinderGeometry args={[0.13, 0.13, 0.4, 16]} />
                <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Headshell */}
            <mesh position={[2.1, 0.62, 0.58]} rotation={[0, Math.PI * 0.08, 0]} castShadow>
                <boxGeometry args={[0.32, 0.1, 0.18]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
            </mesh>
            {/* Stylus cantilever */}
            <mesh position={[2.0, 0.57, 0.62]}>
                <cylinderGeometry args={[0.012, 0.008, 0.1, 8]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
            </mesh>
        </group>
    );
}

// ── Sub-component: indicator light ────────────────────────────────────────
function IndicatorLight() {
    return (
        <mesh position={[3.2, 0.33, 0.65]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
                color="#00ff44"
                emissive="#00cc33"
                emissiveIntensity={1.5}
                roughness={0.1}
                metalness={0}
            />
        </mesh>
    );
}

// ── Inner scene (needs to be inside Canvas) ───────────────────────────────
function RecordPlayerSceneInner({ albumCoverUrl }: { albumCoverUrl: string }) {
    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.35} />
            <directionalLight
                position={[-4, 8, 4]}
                intensity={1.6}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
            />
            <pointLight position={[-0.5, 2, 0]} intensity={0.8} color="#fff8e8" />
            <pointLight position={[3.5, 1.5, 1]} intensity={0.4} color="#aaddff" />
            {/* Glow for indicator light */}
            <pointLight position={[3.2, 0.5, 0.65]} intensity={0.3} color="#00ff44" distance={1.5} />

            {/* Plinth */}
            <RoundedBox args={[8, 0.6, 7]} radius={0.25} position={[0, 0, 0]} receiveShadow>
                <meshStandardMaterial color="#bdb8b0" roughness={0.45} metalness={0.02} />
            </RoundedBox>

            {/* Platter */}
            <mesh position={[-0.4, 0.39, 0]} receiveShadow>
                <cylinderGeometry args={[3.1, 3.1, 0.18, 64]} />
                <meshStandardMaterial color="#a8a8a8" metalness={0.85} roughness={0.18} />
            </mesh>

            {/* Vinyl disc — VinylRecord laid flat; local Z-spin → world Y-spin (turntable) */}
            <group position={[-0.4, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <VinylRecord albumCoverUrl={albumCoverUrl} position={[0, 0, 0]} radius={2.85} />
            </group>

            {/* Tonearm */}
            <TonearmAssembly />

            {/* VU meter */}
            <VUMeter />

            {/* Indicator light */}
            <IndicatorLight />

            {/* Control knob */}
            <ControlKnob />

            {/* Camera controls */}
            <OrbitControls
                enablePan={false}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 2.2}
                minDistance={6}
                maxDistance={18}
                target={[0, 0.5, 0]}
            />
        </>
    );
}

// ── Exported component ────────────────────────────────────────────────────
export interface RecordPlayerSceneProps {
    albumCoverUrl: string;
    songName: string;
    artistName: string;
}

export function RecordPlayerScene({ albumCoverUrl, songName, artistName }: RecordPlayerSceneProps) {
    return (
        <div style={{
            width: "100%",
            height: "100%",
            position: "relative",
            background: "radial-gradient(ellipse at center, #ede9e1 0%, #d8d4cc 100%)",
        }}>
            <Canvas
                camera={{ position: [3, 6, 9], fov: 45 }}
                shadows
                style={{ width: "100%", height: "100%" }}
                gl={{ antialias: true, alpha: true }}
            >
                <RecordPlayerSceneInner albumCoverUrl={albumCoverUrl} />
            </Canvas>
            {/* Track info overlay */}
            <div style={{
                position: "absolute",
                bottom: "28px",
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                pointerEvents: "none",
            }}>
                <div style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#1a1a1a",
                    fontFamily: "'Helvetica Neue', sans-serif",
                    letterSpacing: "0.03em",
                    whiteSpace: "nowrap",
                }}>{songName}</div>
                <div style={{
                    fontSize: "13px",
                    fontWeight: 400,
                    color: "#555555",
                    fontFamily: "'Helvetica Neue', sans-serif",
                    marginTop: "3px",
                    whiteSpace: "nowrap",
                }}>{artistName}</div>
            </div>
        </div>
    );
}
