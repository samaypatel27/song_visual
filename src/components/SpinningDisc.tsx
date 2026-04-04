// ── DO NOT READ THIS FILE IN FULL UNLESS REQUIRED ──────────────────────────
// If the following details are enough for your task, stop here.
//
// FILE: src/components/SpinningDisc.tsx
// STATUS: ⚠️  CURRENTLY UNUSED — preserved for potential re-use.
//   The playlist page no longer renders <SpinningDisc>. Spinning disc is now
//   handled by the PlatterDisc Three.js mesh inside VinylScene.tsx.
//
// ORIGINAL PURPOSE: CSS-overlay disc animation that "flies" from the expanded
//   album sleeve position to the record player platter position on screen.
//   Phase system: hidden → flying → playing → paused
//
// EXPORTED SYMBOLS (still importable if needed):
//   SpinningDisc         — React component (HTML/CSS overlay, not Three.js)
//   getDiscScreenPosition(worldX, worldY, cardSize) → DiscPosition | null
//     Projects the expanded album's disc from Three.js world coords to screen px.
//     Requires window.__camera to be set (done in VinylScene's onCreated).
//   getPlatterScreenPosition() → PlatterTarget | null
//     Projects the record player platter to screen px using window.__camera.
//   DiscPosition         — { x, y, size } in screen pixels
//   PlatterTarget        — { x, y, width, height } in screen pixels
//   DiscPhase            — "hidden" | "flying" | "playing" | "paused"
//
// ToneArm — internal sub-component rendering a CSS tonearm overlay during spin
// ─────────────────────────────────────────────────────────────────────────────

"use client";


import { useEffect, useRef, useState } from "react";

export interface DiscPosition {
    x: number; // screen px, center of disc
    y: number;
    size: number; // diameter in px
}

export interface PlatterTarget {
    x: number; // screen px, center of platter
    y: number;
    width: number;
    height: number;
}

export type DiscPhase = "hidden" | "flying" | "playing" | "paused";

interface SpinningDiscProps {
    albumCoverUrl: string | null;
    startPosition: DiscPosition | null;
    targetPlatter: PlatterTarget | null;
    phase: DiscPhase;
}

/** Projects a Three.js world-space point to CSS pixel coordinates.
 *  Requires window.__camera to be set (done in VinylScene's onCreated). */
export function projectToScreen(worldX: number, worldY: number, worldZ: number): { x: number; y: number } | null {
    const cam = (window as any).__camera;
    if (!cam) return null;

    const THREE = (window as any).THREE;
    // Use the camera's project method via a manual NDC calculation
    // We recreate the projection without importing THREE here
    const vec = {
        x: worldX,
        y: worldY,
        z: worldZ,
    };

    // Apply view projection manually using the camera's matrices
    // cam.matrixWorldInverse and cam.projectionMatrix are plain THREE objects
    const mv = cam.matrixWorldInverse;
    const proj = cam.projectionMatrix;

    // Transform point by view matrix (matrixWorldInverse)
    const e = mv.elements;
    const vx = e[0] * vec.x + e[4] * vec.y + e[8] * vec.z + e[12];
    const vy = e[1] * vec.x + e[5] * vec.y + e[9] * vec.z + e[13];
    const vz = e[2] * vec.x + e[6] * vec.y + e[10] * vec.z + e[14];
    const vw = e[3] * vec.x + e[7] * vec.y + e[11] * vec.z + e[15];

    // Transform by projection matrix
    const p = proj.elements;
    const px = p[0] * vx + p[4] * vy + p[8] * vz + p[12] * vw;
    const py = p[1] * vx + p[5] * vy + p[9] * vz + p[13] * vw;
    const pw = p[3] * vx + p[7] * vy + p[11] * vz + p[15] * vw;

    if (Math.abs(pw) < 1e-10) return null;

    const ndcX = px / pw;
    const ndcY = py / pw;

    return {
        x: (ndcX + 1) / 2 * window.innerWidth,
        y: (-ndcY + 1) / 2 * window.innerHeight,
    };
}

/** Compute the screen-space disc position for the currently expanded album.
 *  albumWorldX/Y — the group origin in Three.js world space.
 *  cardSize — the album's size (diameter in world units).
 *  The disc is slid out cardSize * 0.72 on X from the group origin. */
export function getDiscScreenPosition(
    albumWorldX: number,
    albumWorldY: number,
    cardSize: number
): DiscPosition | null {
    const discWorldX = albumWorldX + cardSize * 0.72;
    const discWorldY = albumWorldY;
    const discWorldZ = 0.1;

    const screen = projectToScreen(discWorldX, discWorldY, discWorldZ);
    if (!screen) return null;

    // Project a point at disc radius away to estimate screen size
    const edgeScreen = projectToScreen(discWorldX + cardSize * 0.44, discWorldY, discWorldZ);
    if (!edgeScreen) return null;

    const screenRadius = Math.abs(edgeScreen.x - screen.x);
    const sizePx = screenRadius * 2;

    return { x: screen.x, y: screen.y, size: sizePx };
}

/** Compute screen-space coordinates for the record player platter.
 *  The record player mesh is at world [48, -23, -2.85], geometry [24, 19].
 *  From visual inspection of the three-quarter PNG:
 *  The platter center is ~50% from left, ~48% from top of the PNG.
 *  We use the mesh center as an approximation and adjust with known offsets. */
export function getPlatterScreenPosition(): PlatterTarget | null {
    // Record player mesh center in world space
    const rpX = 48, rpY = -23, rpZ = -2.85;

    // The platter sits roughly in the center of the record player image.
    // Visual analysis: platter center is slightly left-of-center and slightly above
    // mid-height of the PNG. Offset: -1 unit X (left), +2 units Y (up from mesh center).
    const platCenterX = rpX - 1;
    const platCenterY = rpY + 1.5;

    const screen = projectToScreen(platCenterX, platCenterY, rpZ);
    if (!screen) return null;

    // Platter radius ≈ 4 world units (the full RP is 24 wide, platter ~1/3 of that)
    const edgeScreen = projectToScreen(platCenterX + 4, platCenterY, rpZ);
    if (!edgeScreen) return null;

    const platRadius = Math.abs(edgeScreen.x - screen.x);

    console.log('[RecordPlayer] platter center estimate — x:', Math.round(screen.x), 'y:', Math.round(screen.y));
    console.log('[RecordPlayer] platter size estimate — w:', Math.round(platRadius * 2), 'h:', Math.round(platRadius * 1.3));

    return {
        x: screen.x,
        y: screen.y,
        width: platRadius * 2,
        height: platRadius * 1.3, // foreshortened due to perspective angle
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpinningDisc({ albumCoverUrl, startPosition, targetPlatter, phase }: SpinningDiscProps) {
    const [cssPhase, setCssPhase] = useState<"start" | "fly" | "land" | "spin" | "hidden">("hidden");
    const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (landTimerRef.current) clearTimeout(landTimerRef.current);
        if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

        if (phase === "flying" && startPosition && targetPlatter) {
            console.log('[SpinningDisc] start:', startPosition, '→ target platter:', targetPlatter);
            // Phase 1: appear at start position with no transition
            setCssPhase("start");
            // Phase 2: after one frame, kick off the fly CSS transition
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setCssPhase("fly");
                    console.log('[SpinningDisc] phase: flying → landing at 900ms');
                });
            });
            // Phase 4: after 900ms switch to spinning
            spinTimerRef.current = setTimeout(() => {
                setCssPhase("spin");
                console.log('[SpinningDisc] phase: flying → playing at 900ms');
                console.log('[SpinningDisc] isPlaying: true — spin animation active');
            }, 900);
        } else if (phase === "playing") {
            setCssPhase("spin");
        } else if (phase === "paused") {
            setCssPhase("spin"); // same element, animation-play-state controls it
        } else {
            setCssPhase("hidden");
        }
    }, [phase, startPosition, targetPlatter]);

    if (!albumCoverUrl || !startPosition || !targetPlatter) return null;
    if (cssPhase === "hidden") return null;

    const discSize = startPosition.size;
    const platW = targetPlatter.width;
    const platH = targetPlatter.height;

    // Platter perspective angles — three-quarter view of a turntable
    // rotateX tilts the disc away (like looking at a tilted record)
    // rotateY adds a slight left lean matching the three-quarter perspective
    const platRotateX = 52;  // degrees — tune if needed
    const platRotateY = -12; // degrees

    // CSS transform values per phase
    const getStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: "fixed",
            borderRadius: "50%",
            backgroundImage: `url(${albumCoverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 100,
            pointerEvents: "none",
            // Center the element on its position coordinates
            transformOrigin: "center center",
            willChange: "transform",
        };

        if (cssPhase === "start") {
            return {
                ...base,
                width: discSize,
                height: discSize,
                left: startPosition.x - discSize / 2,
                top: startPosition.y - discSize / 2,
                transform: "rotate(0deg) scale(1)",
                transition: "none",
                opacity: 1,
            };
        }

        if (cssPhase === "fly") {
            // Translate to platter center, shrink to platter size, apply perspective
            const tx = targetPlatter.x - (startPosition.x);
            const ty = targetPlatter.y - (startPosition.y);
            const scaleX = platW / discSize;
            const scaleY = platH / discSize;
            // Use a single scale for the flight then apply non-uniform perspective on land
            const flightScale = Math.sqrt(scaleX * scaleY); // geometric mean

            return {
                ...base,
                width: discSize,
                height: discSize,
                left: startPosition.x - discSize / 2,
                top: startPosition.y - discSize / 2,
                transform: `translate(${tx}px, ${ty}px) scale(${flightScale}) rotate(360deg) rotateX(${platRotateX}deg) rotateY(${platRotateY}deg)`,
                transition: "transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                opacity: 1,
            };
        }

        if (cssPhase === "land" || cssPhase === "spin") {
            return {
                ...base,
                width: platW,
                height: platH,
                left: targetPlatter.x - platW / 2,
                top: targetPlatter.y - platH / 2,
                transform: `rotateX(${platRotateX}deg) rotateY(${platRotateY}deg) rotate(0deg)`,
                transition: "none",
                opacity: 1,
                // Spin animation
                animation: phase === "paused"
                    ? undefined
                    : "spinDisc 2s linear infinite",
                animationPlayState: phase === "paused" ? "paused" : "running",
            };
        }

        return { ...base };
    };

    return (
        <>
            <style>{`
                @keyframes spinDisc {
                    from { transform: rotateX(${platRotateX}deg) rotateY(${platRotateY}deg) rotateZ(0deg); }
                    to   { transform: rotateX(${platRotateX}deg) rotateY(${platRotateY}deg) rotateZ(360deg); }
                }
            `}</style>
            <div style={getStyle()}>
                {/* Spindle hole — counter-rotates to stay stationary */}
                <div style={{
                    position: "absolute",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0,0,0,0.85)",
                    width: "8%",
                    height: "8%",
                    left: "46%",
                    top: "46%",
                    zIndex: 1,
                }} />
            </div>
            {/* Tonearm — thin line that rotates to playing position */}
            {(cssPhase === "spin" || cssPhase === "land") && (
                <ToneArm
                    platX={targetPlatter.x}
                    platY={targetPlatter.y}
                    platW={platW}
                    phase={cssPhase === "spin" ? "playing" : "landing"}
                />
            )}
        </>
    );
}

function ToneArm({ platX, platY, platW, phase }: {
    platX: number; platY: number; platW: number; phase: "landing" | "playing";
}) {
    // Tonearm pivot is to the upper-right of the platter
    const pivotX = platX + platW * 0.65;
    const pivotY = platY - platW * 0.45;
    const armLength = platW * 0.9;

    return (
        <div style={{
            position: "fixed",
            left: pivotX,
            top: pivotY,
            width: 3,
            height: armLength,
            background: "linear-gradient(to bottom, rgba(180,180,200,0.9), rgba(100,100,120,0.7))",
            borderRadius: 2,
            transformOrigin: "top center",
            transform: phase === "playing" ? "rotate(-25deg)" : "rotate(-45deg)",
            transition: "transform 1200ms ease-in-out",
            zIndex: 101,
            pointerEvents: "none",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
        }} />
    );
}
