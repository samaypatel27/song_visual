"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VinylRecord } from "@/components/VinylRecord";

// ── Knurling ring Y positions ──────────────────────────────────────────────
const KNURL_COUNT = 8;
const KNURL_YS = Array.from({ length: KNURL_COUNT }, (_, i) =>
    -0.12 + (i / (KNURL_COUNT - 1)) * 0.24
);

// ── Tonearm curve — coordinates RELATIVE to pivot at world [3.3, 0, -1.8] ─
const ARM_CURVE = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.0, 0.65,  0.0),
    new THREE.Vector3(-0.2, 0.65,  0.8),
    new THREE.Vector3(-0.5, 0.65,  1.6),
    new THREE.Vector3(-1.0, 0.65,  2.3),
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

// ── Sub-component: tonearm assembly (pivot-relative coords) ───────────────
function TonearmAssembly({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
    return (
        // Pivot group at world [3.3, 0, -1.8]; initial rotation is rest angle (0.45 rad)
        <group ref={groupRef} position={[3.3, 0, -1.8]} rotation={[0, 0.45, 0]}>
            {/* Pivot base — relative to pivot */}
            <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.28, 0.5, 32]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Pivot top cap */}
            <mesh position={[0, 0.62, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.95} roughness={0.05} />
            </mesh>
            {/* Arm tube — ARM_GEO uses pivot-relative coords */}
            <mesh castShadow>
                <primitive object={ARM_GEO} />
                <meshStandardMaterial color="#d4d4d4" metalness={0.95} roughness={0.05} />
            </mesh>
            {/* Counterweight — relative to pivot */}
            <mesh position={[0.2, 0.65, -0.7]}>
                <cylinderGeometry args={[0.13, 0.13, 0.4, 16]} />
                <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Headshell — relative to pivot */}
            <mesh position={[-1.2, 0.62, 2.38]} rotation={[0, Math.PI * 0.08, 0]} castShadow>
                <boxGeometry args={[0.32, 0.1, 0.18]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
            </mesh>
            {/* Stylus cantilever — relative to pivot */}
            <mesh position={[-1.3, 0.57, 2.42]}>
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

// ── Inner scene props ─────────────────────────────────────────────────────
interface RecordPlayerSceneInnerProps {
    albumCoverUrl: string;
    onPhase3?: () => void;
}

// ── Inner scene (needs to be inside Canvas) ───────────────────────────────
function RecordPlayerSceneInner({ albumCoverUrl, onPhase3 }: RecordPlayerSceneInnerProps) {

    // ── Animation refs ────────────────────────────────────────────────────
    const dustCoverPivotRef  = useRef<THREE.Group>(null);
    const tonearmGroupRef    = useRef<THREE.Group>(null);
    const platterGroupRef    = useRef<THREE.Group>(null);
    const vinylSpinEnabledRef = useRef<boolean>(true);
    const animRef = useRef({
        active: false,
        phase: 0,
        elapsed: 0,
        platSpinSpeed: 0,
    });

    // ── Trigger animation whenever a new track is selected ────────────────
    useEffect(() => {
        if (!albumCoverUrl) return;

        // Reset all animated objects to Phase 0 state
        if (tonearmGroupRef.current) {
            tonearmGroupRef.current.rotation.y = 0.45; // back to rest angle
            tonearmGroupRef.current.position.y = 0;
        }
        if (dustCoverPivotRef.current) {
            dustCoverPivotRef.current.rotation.x = 0;
        }
        if (platterGroupRef.current) {
            platterGroupRef.current.rotation.y = 0;
        }
        vinylSpinEnabledRef.current = true;
        animRef.current = { active: true, phase: 1, elapsed: 0, platSpinSpeed: 0 };
    }, [albumCoverUrl]);

    // ── Animation driver ──────────────────────────────────────────────────
    useFrame(({}, delta) => {
        const anim = animRef.current;
        if (!anim.active) return;

        // Cap delta to prevent jumps after tab switch / long frame
        const dt = Math.min(delta, 0.1);
        anim.elapsed += dt;

        if (anim.phase === 1) {
            // Phase 1: dust cover opens (1.5 s, easeOut cubic)
            const p  = Math.min(anim.elapsed / 1.5, 1);
            const ep = 1 - Math.pow(1 - p, 3);
            if (dustCoverPivotRef.current) {
                dustCoverPivotRef.current.rotation.x = ep * -1.15;
            }
            if (p >= 1) { anim.phase = 2; anim.elapsed = 0; }

        } else if (anim.phase === 2) {
            const e = anim.elapsed;
            if (tonearmGroupRef.current) {
                if (e < 0.5) {
                    // Step A: lift tonearm (linear, 0–0.5 s)
                    tonearmGroupRef.current.position.y = (e / 0.5) * 0.15;
                } else if (e < 1.5) {
                    // Step B: swing from rest (0.45 rad) to play (0 rad), easeInOut quad
                    const p  = (e - 0.5) / 1.0;
                    const ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
                    tonearmGroupRef.current.rotation.y = 0.45 * (1 - ep);
                } else if (e < 2.0) {
                    // Step C: lower onto record, easeIn quad (1.5–2.0 s)
                    const p = (e - 1.5) / 0.5;
                    tonearmGroupRef.current.position.y = 0.15 * (1 - p * p);
                }
            }
            if (e >= 2.0) {
                anim.phase = 3;
                anim.elapsed = 0;
                vinylSpinEnabledRef.current = false; // platterGroupRef takes over
                onPhase3?.();
            }

        } else if (anim.phase === 3) {
            // Phase 3: platter spins up to 33.33 RPM (≈ 3.49 rad/s)
            const TARGET = (33.33 / 60) * 2 * Math.PI;
            anim.platSpinSpeed = THREE.MathUtils.lerp(anim.platSpinSpeed, TARGET, 0.03);
            if (platterGroupRef.current) {
                platterGroupRef.current.rotation.y += anim.platSpinSpeed * dt;
            }
        }
    });

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

            {/* Shadow receiver plane */}
            <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[20, 20]} />
                <meshStandardMaterial color="#000000" transparent opacity={0.15} roughness={1} metalness={0} />
            </mesh>

            {/* Plinth — matte off-white ceramic */}
            <RoundedBox args={[8, 0.6, 7]} radius={0.25} position={[0, 0, 0]} receiveShadow castShadow>
                <meshStandardMaterial color="#f0ede8" roughness={0.92} metalness={0.0} />
            </RoundedBox>

            {/* Platter + Vinyl — share one group for Phase 3 rotation */}
            <group ref={platterGroupRef} position={[-0.4, 0, 0]}>
                {/* Platter disc — brushed aluminum */}
                <mesh position={[0, 0.39, 0]} receiveShadow>
                    <cylinderGeometry args={[3.1, 3.1, 0.18, 64]} />
                    <meshStandardMaterial color="#b8b8b8" metalness={0.85} roughness={0.25} />
                </mesh>
                {/* Vinyl disc — rotated flat; VinylRecord spins on Z (= world Y when platter is flat) */}
                <group position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <VinylRecord
                        albumCoverUrl={albumCoverUrl}
                        position={[0, 0, 0]}
                        radius={2.85}
                        spinEnabledRef={vinylSpinEnabledRef}
                    />
                </group>
            </group>

            {/* Tonearm */}
            <TonearmAssembly groupRef={tonearmGroupRef} />

            {/* Tonearm rest peg — stationary chrome pillar on plinth */}
            <mesh position={[1.1, 0.5, 0.95]}>
                <cylinderGeometry args={[0.04, 0.04, 0.18, 12]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.95} roughness={0.05} />
            </mesh>

            {/* Dust cover — pivot at rear-bottom edge of plinth */}
            <group ref={dustCoverPivotRef} position={[0, 0.3, -3.6]}>
                {/* Cover mesh positioned relative to pivot so it swings open backward on X */}
                <mesh position={[0, 1.4, 3.6]} castShadow>
                    <boxGeometry args={[8.4, 2.8, 7.2]} />
                    <meshPhysicalMaterial
                        color="#1a1a2a"
                        transmission={0.75}
                        roughness={0.05}
                        thickness={0.8}
                        opacity={1.0}
                    />
                </mesh>
            </group>

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
    onPhase3?: () => void;
}

export function RecordPlayerScene({ albumCoverUrl, songName, artistName, onPhase3 }: RecordPlayerSceneProps) {
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
                <RecordPlayerSceneInner albumCoverUrl={albumCoverUrl} onPhase3={onPhase3} />
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
