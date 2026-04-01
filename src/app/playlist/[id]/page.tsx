// Playlist detail page — /playlist/[id]
//
// Layer order (z-index):
//   0 — GLSL shader background   (ShaderBackground, position:fixed)
//   1 — 3D vinyl records          (VinylScene, transparent R3F Canvas, position:fixed)
//   10 — TrackListPanel           (position:fixed, right third)
//   20 — D-pad navigation overlay (DPadControls, position:fixed, bottom-right)
//
// Track data pipeline:
//   VinylScene accumulates {trackNumber, trackName, durationMs} per album in a ref
//   as playlist-tracks pages are fetched.  On click, onAlbumExpand fires with that
//   in-memory array → NO secondary Spotify API call needed.

"use client";

import { use, useRef, useState, useCallback } from "react";
import { ShaderBackground } from "@/components/ShaderBackground";
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

    const pressedDirection = useRef<Direction | null>(null);
    const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

    const [panelVisible, setPanelVisible] = useState(false);
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
            <ShaderBackground />

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
