// ── DO NOT READ THIS FILE IN FULL UNLESS REQUIRED ──────────────────────────
// If the following details are enough for your task, stop here.
//
// FILE: src/app/playlist/[id]/page.tsx
// PURPOSE: Playlist detail page — /playlist/[id]
//   Renders the full interactive 3D album-wall experience for a single playlist.
//
// LAYER ORDER (z-index):
//   0  — ShaderBackground    (GLSL animated background, position:fixed)
//   1  — VinylScene          (R3F Canvas with 3D album covers + record player, position:fixed)
//   10 — TrackListPanel      (right-side slide-in panel showing tracks, position:fixed)
//   20 — DPadControls        (on-screen d-pad for camera panning, currently commented out)
//
// KEY STATE:
//   panelVisible / panelAlbumName / panelAlbumCoverUrl / panelTracks / panelDataReady
//     — control TrackListPanel visibility and content
//
// KEY CALLBACKS passed down to VinylScene:
//   onAlbumExpand  — fires when user clicks an album; populates panel data from in-memory tracks
//   onDiscSlide    — fires when the vinyl disc slides out (shows panel)
//   onCollapse     — fires when scene zooms back out (hides panel)
//
// DATA FLOW: VinylScene accumulates {trackId, trackNumber, trackName, durationMs} per album
//   as playlist-track pages are fetched in the background. onAlbumExpand passes that in-memory
//   array directly → NO secondary Spotify API call needed when expanding an album.
//
// PLAYBACK: TrackListPanel.handlePlay → POST /api/spotify/play
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { use, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
// import { ShaderBackground } from "@/components/ShaderBackground";
import { VinylScene, type PlaylistTrackEntry } from "@/components/VinylScene";
import { DPadControls } from "@/components/DPadControls";
import { TrackListPanel } from "@/components/TrackListPanel";
import type { Track } from "@/components/TrackListPanel";

// Extend TrackListPanel Track to include optional trackId (passed from VinylScene)
// PlaylistTrackEntry is structurally compatible — cast directly

type Direction = "up" | "down" | "left" | "right" | "reset";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function PlaylistDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();

    const pressedDirection = useRef<Direction | null>(null);
    const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [panelVisible, setPanelVisible] = useState(false);
    const [albumExpanded, setAlbumExpanded] = useState(false);
    const [panelAlbumName, setPanelAlbumName] = useState("");
    const [panelAlbumCoverUrl, setPanelAlbumCoverUrl] = useState("");
    const [panelTracks, setPanelTracks] = useState<Track[]>([]);
    const [panelDataReady, setPanelDataReady] = useState(false);

    const handleAlbumExpand = useCallback((
        albumId: string,
        albumName: string,
        albumCoverUrl: string,
        playlistTracks: PlaylistTrackEntry[]
    ) => {
        const ts = Date.now();
        console.log(`[Click] album clicked: "${albumName}" | albumId: ${albumId} | timestamp: ${ts}`);
        console.log(`[Click] playlist tracks from this album: ${playlistTracks.length}`);
        console.log(`[TrackListPanel] using in-memory filter — no API call made`);

        if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
        }

        setAlbumExpanded(true);
        setPanelAlbumName(albumName);
        setPanelAlbumCoverUrl(albumCoverUrl);
        setPanelDataReady(false);  // reset while data loads
        // PlaylistTrackEntry includes trackId — cast directly to Track
        setPanelTracks(playlistTracks as unknown as Track[]);
        setPanelDataReady(true);  // data received, even if 0 tracks

        console.log(`[Click] panel tracks set — count: ${playlistTracks.length} | timestamp: ${Date.now()} | elapsed: ${Date.now() - ts}ms`);
    }, []);

    const handleDiscSlide = useCallback(() => {
        setPanelVisible(true);
    }, []);

    const handleCollapse = useCallback(() => {
        setAlbumExpanded(false);
        setPanelVisible(false);
        setPanelDataReady(false);

        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);

        clearTimerRef.current = setTimeout(() => {
            setPanelTracks([]);
            setPanelAlbumName("");
            setPanelAlbumCoverUrl("");
        }, 400);
    }, []);

    return (
        <>
            {/* <ShaderBackground /> */}

            {/* Back to dashboard — hidden when an album is expanded */}
            {!albumExpanded && <button
                onClick={() => router.push("/dashboard")}
                style={{
                    position: "fixed",
                    top: "28px",
                    left: "28px",
                    zIndex: 30,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px 10px 14px",
                    background: "rgba(18, 14, 10, 0.55)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(200, 160, 80, 0.18)",
                    borderRadius: "12px",
                    cursor: "pointer",
                    color: "rgba(232, 213, 176, 0.7)",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "0.78em",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    transition: "background 200ms ease, border-color 200ms ease, color 200ms ease",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 0.5px 0 rgba(200,160,80,0.08)",
                }}
                onMouseEnter={e => {
                    const el = e.currentTarget;
                    el.style.background = "rgba(30, 22, 12, 0.75)";
                    el.style.borderColor = "rgba(200, 160, 80, 0.45)";
                    el.style.color = "rgba(232, 213, 176, 1)";
                }}
                onMouseLeave={e => {
                    const el = e.currentTarget;
                    el.style.background = "rgba(18, 14, 10, 0.55)";
                    el.style.borderColor = "rgba(200, 160, 80, 0.18)";
                    el.style.color = "rgba(232, 213, 176, 0.7)";
                }}
            >
                {/* Vinyl groove chevron */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                        d="M9 11.5L4.5 7 9 2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                Playlists
            </button>}

            <VinylScene
                playlistId={id}
                pressedDirection={pressedDirection}
                onAlbumExpand={handleAlbumExpand}
                onDiscSlide={handleDiscSlide}
                onCollapse={handleCollapse}
            />

            <TrackListPanel
                albumName={panelAlbumName}
                albumCoverUrl={panelAlbumCoverUrl}
                tracks={panelTracks}
                visible={panelVisible}
                dataReady={panelDataReady}
            />

            <DPadControls pressedDirection={pressedDirection} />
        </>
    );
}
