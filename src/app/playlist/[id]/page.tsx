// Playlist detail page — /playlist/[id]
// Only the shader background is rendered at this stage.
// UI content (track list, glassmorphic panel, etc.) will be added in a
// subsequent task once the background is confirmed working.

import { ShaderBackground } from "@/components/ShaderBackground";

export default function PlaylistDetailPage() {
    return (
        <>
            {/*
        ShaderBackground mounts a Three.js WebGLRenderer inside a
        position:fixed div at z-index:0.  It covers the full viewport
        and sits behind any future page content placed here.
      */}
            <ShaderBackground />
        </>
    );
}
