// Playlist detail page — /playlist/[id]
//
// Layer order (z-index):
//   0 — GLSL shader background   (ShaderBackground, position:fixed)
//   1 — 3D vinyl records          (VinylScene, transparent R3F Canvas, position:fixed)
//   10 — D-pad navigation overlay (DPadControls, position:fixed, bottom-right)
//
// pressedDirection ref is created here and passed to BOTH VinylScene (reads it
// in useFrame to move the camera) and DPadControls (writes to it on pointer events).
// Using a ref avoids re-renders on every button press.

"use client";

import { useRef } from "react";
import { ShaderBackground } from "@/components/ShaderBackground";
import { VinylScene } from "@/components/VinylScene";
import { DPadControls } from "@/components/DPadControls";

type Direction = "up" | "down" | "left" | "right" | "reset";

interface PageProps {
    params: Promise<{ id: string }>;
}

// Page must be a Client Component because we use useRef.
// We extract the playlist ID via React.use() for the Promise params.
import { use } from "react";

export default function PlaylistDetailPage({ params }: PageProps) {
    const { id } = use(params);

    // Shared ref — written by DPadControls, read by VinylScene's useFrame
    const pressedDirection = useRef<Direction | null>(null);

    return (
        <>
            {/* z-index: 0 — full-screen GLSL organic shader */}
            <ShaderBackground />

            {/* z-index: 1 — transparent R3F canvas, one disc per unique album */}
            <VinylScene playlistId={id} pressedDirection={pressedDirection} />

            {/* z-index: 10 — D-pad camera controls, fixed bottom-right */}
            <DPadControls pressedDirection={pressedDirection} />
        </>
    );
}
