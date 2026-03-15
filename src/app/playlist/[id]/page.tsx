// Playlist detail page — /playlist/[id]
//
// Layer order (z-index):
//   0 — GLSL shader background   (ShaderBackground, position:fixed)
//   1 — 3D vinyl records          (VinylScene, transparent R3F Canvas, position:fixed)

import { ShaderBackground } from "@/components/ShaderBackground";
import { VinylScene } from "@/components/VinylScene";

// In Next.js 15 App Router, params from dynamic routes are a Promise.
interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PlaylistDetailPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <>
            {/* z-index: 0 — full-screen GLSL organic shader */}
            <ShaderBackground />

            {/* z-index: 1 — transparent R3F canvas with one disc per track */}
            <VinylScene playlistId={id} />
        </>
    );
}
