"use client";

import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { VinylRecord } from "@/components/VinylRecord";

// ── Walnut wood texture — generated once at runtime ───────────────────────
function createWalnutTexture(): THREE.CanvasTexture {
    const W = 512, H = 256;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Warm honey-brown base
    ctx.fillStyle = "#8B5E3C";
    ctx.fillRect(0, 0, W, H);

    // 50 sinusoidal horizontal grain lines — deterministic via index
    const lineCount = 50;
    for (let i = 0; i < lineCount; i++) {
        const y0 = (i / lineCount) * H;
        const isDark = (i % 3) !== 2;
        ctx.strokeStyle = isDark ? "#6B4423" : "#A0722A";
        ctx.lineWidth = 0.8 + (i % 4) * 0.4;
        ctx.globalAlpha = 0.35 + (i % 5) * 0.09;

        const freq = 1.5 + (i % 7) * 0.3;                 // 1.5–3.3 full periods
        const amp = 1.5 + (i % 5) * 0.7;                 // 1.5–4.5 px amplitude
        const phase = (i * 0.618) % (Math.PI * 2);          // golden ratio phase offset

        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
            const y = y0 + Math.sin((x / W) * Math.PI * freq * 2 + phase) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

// ── Knurling ring Y positions ──────────────────────────────────────────────
const KNURL_COUNT = 8;
const KNURL_YS = Array.from({ length: KNURL_COUNT }, (_, i) =>
    -0.12 + (i / (KNURL_COUNT - 1)) * 0.24
);

// ── Tonearm curve — coordinates RELATIVE to pivot at world [3.3, 0, -1.8] ─
const ARM_CURVE = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.65, 0.0),
    new THREE.Vector3(-0.2, 0.65, 0.8),
    new THREE.Vector3(-0.5, 0.65, 1.6),
    new THREE.Vector3(-1.0, 0.65, 2.3),
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

// ── Sub-component: tonearm assembly — dark gunmetal ───────────────────────
function TonearmAssembly({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
    return (
        // Pivot group at world [3.3, 0, -1.8]; initial rotation is rest angle (0.45 rad)
        <group ref={groupRef} position={[3.3, 0, -1.8]} rotation={[0, 0.45, 0]}>
            {/* Pivot base — gunmetal */}
            <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.28, 0.5, 32]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Pivot top cap — gunmetal */}
            <mesh position={[0, 0.62, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Arm tube — dark gunmetal */}
            <mesh castShadow>
                <primitive object={ARM_GEO} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Counterweight — polished dark cylinder */}
            <mesh position={[0.2, 0.65, -0.7]}>
                <cylinderGeometry args={[0.13, 0.13, 0.4, 16]} />
                <meshStandardMaterial color="#1e1e1e" metalness={0.9} roughness={0.15} />
            </mesh>
            {/* Headshell — slightly lighter gunmetal */}
            <mesh position={[-1.2, 0.62, 2.38]} rotation={[0, Math.PI * 0.08, 0]} castShadow>
                <boxGeometry args={[0.32, 0.1, 0.18]} />
                <meshStandardMaterial color="#3a3a3a" roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Stylus cantilever */}
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

// ── Sub-component: decorative control panel ───────────────────────────────
function ControlPanel() {
    // Front-right of plinth surface (plinth top at y=0.3)
    return (
        <group position={[2.4, 0.33, 2.65]}>
            {/* Panel body */}
            <mesh>
                <boxGeometry args={[1.6, 0.06, 0.75]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.1} />
            </mesh>
            {/* Button 1 */}
            <mesh position={[-0.5, 0.055, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
                <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.4} />
            </mesh>
            {/* Button 2 */}
            <mesh position={[0, 0.055, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
                <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.4} />
            </mesh>
            {/* Button 3 */}
            <mesh position={[0.5, 0.055, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
                <meshStandardMaterial color="#444444" roughness={0.5} metalness={0.4} />
            </mesh>
        </group>
    );
}

// ── Inner scene props ─────────────────────────────────────────────────────
interface RecordPlayerSceneInnerProps {
    albumCoverUrl: string;
    onPhase3?: () => void;
}

// ── Inner scene (needs to be inside Canvas) ───────────────────────────────
function RecordPlayerSceneInner({ albumCoverUrl, onPhase3 }: RecordPlayerSceneInnerProps) {

    // ── Walnut texture (created once) ─────────────────────────────────────
    const walnutTexture = useMemo(() => createWalnutTexture(), []);

    // ── Animation refs ────────────────────────────────────────────────────
    const dustCoverPivotRef = useRef<THREE.Group>(null);
    const tonearmGroupRef = useRef<THREE.Group>(null);
    const platterGroupRef = useRef<THREE.Group>(null);
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
    useFrame(({ }, delta) => {
        const anim = animRef.current;
        if (!anim.active) return;

        // Cap delta to prevent jumps after tab switch / long frame
        const dt = Math.min(delta, 0.1);
        anim.elapsed += dt;

        if (anim.phase === 1) {
            // Phase 1: dust cover opens (1.5 s, easeOut cubic)
            const p = Math.min(anim.elapsed / 1.5, 1);
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
                    const p = (e - 0.5) / 1.0;
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
            {/* ── Lighting ─────────────────────────────────────────────────────── */}
            <ambientLight intensity={0.35} />
            {/* Existing cool-side fill */}
            <directionalLight
                position={[-4, 8, 4]}
                intensity={1.6}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
            />
            {/* Warm directional — highlights walnut grain and gunmetal */}
            <directionalLight
                position={[3, 5, 3]}
                intensity={1.6}
                color="#fff5e0"
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

            {/* ── Plinth — walnut wood ──────────────────────────────────────────── */}
            <RoundedBox args={[8, 0.6, 7]} radius={0.25} position={[0, 0, 0]} receiveShadow castShadow>
                <meshStandardMaterial
                    map={walnutTexture}
                    roughness={0.82}
                    metalness={0.0}
                />
            </RoundedBox>

            {/* ── Platter + Vinyl — share one group for Phase 3 rotation ────────── */}
            <group ref={platterGroupRef} position={[-0.4, 0, 0]}>
                {/* Platter disc — brushed aluminum */}
                <mesh position={[0, 0.39, 0]} receiveShadow>
                    <cylinderGeometry args={[3.1, 3.1, 0.18, 64]} />
                    <meshStandardMaterial color="#b8b8b8" metalness={0.85} roughness={0.25} />
                </mesh>
                {/* Rubber platter mat — matte black, sits on top of platter disc */}
                <mesh position={[0, 0.49, 0]}>
                    <cylinderGeometry args={[2.9, 2.9, 0.04, 64]} />
                    <meshStandardMaterial color="#111111" roughness={0.95} metalness={0.0} />
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

            {/* ── Tonearm pivot mount block — static housing on plinth ─────────── */}
            <mesh position={[3.3, 0.37, -1.8]}>
                <boxGeometry args={[0.8, 0.14, 0.8]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* ── Tonearm (animates, so ref-driven) ────────────────────────────── */}
            <TonearmAssembly groupRef={tonearmGroupRef} />

            {/* Tonearm rest peg — gunmetal to match arm */}
            <mesh position={[1.1, 0.5, 0.95]}>
                <cylinderGeometry args={[0.04, 0.04, 0.18, 12]} />
                <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* ── Dust cover — walnut wood lid, 5 thin panels, open at bottom ─── */}
            {/*   Pivot at plinth rear-top edge: Z = −3.5 (depth/2), Y = 0.3 (top) */}
            {/*   Wall thickness T = 0.15. Outer shell: 8.4 W × 2.8 H × 7.2 D     */}
            {/*   Back wall outer face sits at pivot-local Z = 0 → world Z = −3.5,  */}
            {/*   flush with plinth rear edge. Animation ref/axis untouched.         */}
            <group ref={dustCoverPivotRef} position={[0, 0.3, -3.5]}>
                {/* Top panel (roof) */}
                <mesh position={[0, 2.725, 3.6]} castShadow receiveShadow>
                    <boxGeometry args={[8.4, 0.15, 7.2]} />
                    <meshStandardMaterial map={walnutTexture} roughness={0.82} metalness={0.0} />
                </mesh>
                {/* Left wall */}
                <mesh position={[-4.125, 1.4, 3.6]} castShadow receiveShadow>
                    <boxGeometry args={[0.15, 2.8, 7.2]} />
                    <meshStandardMaterial map={walnutTexture} roughness={0.82} metalness={0.0} />
                </mesh>
                {/* Right wall */}
                <mesh position={[4.125, 1.4, 3.6]} castShadow receiveShadow>
                    <boxGeometry args={[0.15, 2.8, 7.2]} />
                    <meshStandardMaterial map={walnutTexture} roughness={0.82} metalness={0.0} />
                </mesh>
                {/* Back wall — outer face at pivot-local Z=0, flush with plinth rear */}
                <mesh position={[0, 1.4, 0.075]} castShadow receiveShadow>
                    <boxGeometry args={[8.4, 2.8, 0.15]} />
                    <meshStandardMaterial map={walnutTexture} roughness={0.82} metalness={0.0} />
                </mesh>
                {/* Front wall */}
                <mesh position={[0, 1.4, 7.125]} castShadow receiveShadow>
                    <boxGeometry args={[8.4, 2.8, 0.15]} />
                    <meshStandardMaterial map={walnutTexture} roughness={0.82} metalness={0.0} />
                </mesh>
            </group>

            {/* ── Decorative elements ──────────────────────────────────────────── */}
            <VUMeter />
            <IndicatorLight />
            <ControlKnob />
            <ControlPanel />

            {/* Camera controls */}
            <OrbitControls
                enableRotate={false}
                enablePan={false}
                enableZoom={false}
                minDistance={10}
                maxDistance={32}
                target={[0, 1, 0]}
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
            background: "transparent",
        }}>
            <Canvas
                camera={{ position: [15, 6, 17], fov: 44 }}
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
                    color: "#ffffff",
                    fontFamily: "'Helvetica Neue', sans-serif",
                    letterSpacing: "0.03em",
                    whiteSpace: "nowrap",
                }}>{songName}</div>
                <div style={{
                    fontSize: "13px",
                    fontWeight: 400,
                    color: "#ffffff",
                    fontFamily: "'Helvetica Neue', sans-serif",
                    marginTop: "3px",
                    whiteSpace: "nowrap",
                }}>{artistName}</div>
            </div>
        </div>
    );
}
