"use client";

import { useEffect, useRef, useState } from "react";
import { RecordPlayerScene } from "@/components/RecordPlayerScene";

interface Track {
    trackId: string;
    songName: string;
    albumName: string;
    albumCoverUrl: string;
    artistName: string;
    durationMs: number;
}

type ToastType = "success" | "error" | "warn" | "loading";
interface Toast { id: number; type: ToastType; message: string; duration: number; }

function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function CalendarIcon({ color }: { color: string }) {
    return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
            <rect x="0.5" y="2" width="10" height="8.5" stroke={color} strokeWidth="1" fill="none" />
            <line x1="0.5" y1="5" x2="10.5" y2="5" stroke={color} strokeWidth="1" />
            <line x1="3" y1="0.5" x2="3" y2="3.5" stroke={color} strokeWidth="1.5" />
            <line x1="8" y1="0.5" x2="8" y2="3.5" stroke={color} strokeWidth="1.5" />
        </svg>
    );
}

type TimeRange = "short_term" | "medium_term" | "long_term";

const RANGE_LABELS: Record<TimeRange, string> = {
    short_term: "LAST 4 WEEKS",
    medium_term: "LAST 6 MONTHS",
    long_term: "ALL TIME",
};

const MENU_BUTTONS: { label: string; range: TimeRange }[] = [
    { label: "Last 4 Weeks", range: "short_term" },
    { label: "Last 6 Months", range: "medium_term" },
    { label: "All Time", range: "long_term" },
];

export default function MostPlayedPage() {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedRange, setSelectedRange] = useState<TimeRange>("short_term");
    const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [menuHovered, setMenuHovered] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<number | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const toastIdRef = useRef(0);
    const pendingTrackRef = useRef<Track | null>(null);

    const addToast = (type: ToastType, message: string, duration = 4000) => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, type, message, duration }]);
        if (duration > 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    };

    const handlePlay = async (track: Track) => {
        if (playingId === track.trackId) return;
        setPlayingId(track.trackId);
        const loadId = ++toastIdRef.current;
        setToasts(prev => [...prev, { id: loadId, type: "loading", message: `Starting "${track.songName}"…`, duration: 0 }]);
        try {
            const res = await fetch("/api/spotify/play", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trackId: track.trackId }),
            });
            setToasts(prev => prev.filter(t => t.id !== loadId));
            const data = await res.json();
            if (res.ok) {
                addToast("success", `Now playing "${track.songName}"${data.device ? ` on ${data.device}` : ""}`);
            } else if (res.status === 404) {
                addToast("warn", "No Spotify device found — open Spotify on any device first.");
            } else if (res.status === 403) {
                addToast("error", "Spotify Premium is required for playback control.");
            } else if (res.status === 429) {
                addToast("warn", "Slow down — Spotify is rate-limiting playback requests.");
            } else {
                addToast("error", `Couldn't start playback — ${data.error ?? "unknown error"}.`);
            }
        } catch {
            setToasts(prev => prev.filter(t => t.id !== loadId));
            addToast("error", "Connection to Spotify timed out — try again.");
        } finally {
            setPlayingId(null);
        }
    };

    const fetchRange = async (range: TimeRange) => {
        setLoading(true);
        setError(false);
        setTracks([]);
        try {
            const res = await fetch(`/api/spotify/most-played?time_range=${range}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setTracks(data.tracks);
            console.log("[most-played] rendered iPod UI — track count:", data.tracks.length);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Preserve existing console logging for all three ranges
        const fetchAllRanges = async () => {
            const timeRanges: TimeRange[] = ["short_term", "medium_term", "long_term"];
            for (const range of timeRanges) {
                try {
                    const res = await fetch(`/api/spotify/most-played?time_range=${range}`);
                    if (!res.ok) throw new Error("Failed to fetch");
                    const data = await res.json();
                    console.log(`\n=== Most Played Songs (${range}) ===`);
                    data.tracks.forEach((track: Track, index: number) => {
                        const minutes = Math.floor(track.durationMs / 60000);
                        const seconds = ((track.durationMs % 60000) / 1000).toFixed(0);
                        const formattedLength = `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`;
                        console.log(`${index + 1}. ${track.songName}`);
                        console.log(`   Artist: ${track.artistName}`);
                        console.log(`   Album: ${track.albumName}`);
                        console.log(`   Album Cover: ${track.albumCoverUrl}`);
                        console.log(`   Length: ${formattedLength}`);
                    });
                } catch (err) {
                    console.error(`Error fetching data for ${range}:`, err);
                }
            }
        };

        fetchAllRanges();
        fetchRange("short_term");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "row",
            background: "radial-gradient(ellipse at center, #ede9e1 0%, #d8d4cc 100%)",
            backgroundColor: "#e8e4dc",
        }}>
            {/* Left panel — iPod */}
            <div style={{
                width: selectedTrack ? "460px" : "100%",
                height: "100vh",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                transition: "width 0.45s ease",
                boxSizing: "border-box",
            }}>
                {/* iPod Body */}
                <div style={{
                    width: "373px",
                    height: "587px",
                    borderRadius: "37px",
                    background: "linear-gradient(160deg, #d8d8d8 0%, #b8b8b8 35%, #c8c8c8 60%, #a8a8a8 100%)",
                    boxShadow: "0 27px 80px rgba(0,0,0,0.35), 0 5px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.15)",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}>
                    {/* Brushed metal grain texture */}
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        background: "repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)",
                        borderRadius: "37px",
                        pointerEvents: "none",
                        zIndex: 0,
                    }} />
                    {/* Scratch 1 */}
                    <div style={{ position: "absolute", top: "83px", left: "29px", width: "104px", height: "1px", background: "rgba(255,255,255,0.15)", transform: "rotate(-8deg)", pointerEvents: "none", zIndex: 0 }} />
                    {/* Scratch 2 */}
                    <div style={{ position: "absolute", top: "157px", left: "56px", width: "64px", height: "1px", background: "rgba(0,0,0,0.08)", transform: "rotate(5deg)", pointerEvents: "none", zIndex: 0 }} />
                    {/* Scratch 3 */}
                    <div style={{ position: "absolute", top: "117px", right: "43px", width: "83px", height: "1px", background: "rgba(255,255,255,0.15)", transform: "rotate(-3deg)", pointerEvents: "none", zIndex: 0 }} />

                    {/* Screen — 253px tall, 5px border */}
                    <div style={{
                        width: "calc(100% - 43px)",
                        height: "253px",
                        margin: "27px 21px 0",
                        borderRadius: "8px",
                        border: "5px solid #1a1a1a",
                        boxShadow: "inset 0 3px 5px rgba(0,0,0,0.5)",
                        overflow: "hidden",
                        flexShrink: 0,
                        position: "relative",
                        zIndex: 1,
                    }}>
                        <div style={{
                            width: "100%",
                            height: "100%",
                            background: "#f0f0e8",
                            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                            display: "flex",
                            flexDirection: "column",
                        }}>
                            {/* Header bar */}
                            <div style={{
                                height: "27px",
                                background: "#2a5cad",
                                display: "flex",
                                alignItems: "center",
                                padding: "0 8px",
                                flexShrink: 0,
                                gap: "5px",
                                position: "relative",
                            }}>
                                {showMenu ? (
                                    <span style={{
                                        position: "absolute",
                                        left: 0,
                                        right: 0,
                                        textAlign: "center",
                                        fontSize: "10px",
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        letterSpacing: "0.08em",
                                        fontFamily: "'Chicago', 'Helvetica Neue', sans-serif",
                                        pointerEvents: "none",
                                    }}>VIEW TOP PLAYED BY DATE</span>
                                ) : (
                                    <span style={{
                                        fontSize: "12px",
                                        fontWeight: 700,
                                        color: "#ffffff",
                                        letterSpacing: "0.05em",
                                        fontFamily: "'Chicago', 'Helvetica Neue', sans-serif",
                                        flex: 1,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                    }}>{`TOP PLAYED (${RANGE_LABELS[selectedRange]})`}</span>
                                )}
                                {/* Battery icon — always visible at right */}
                                <div style={{
                                    width: "19px",
                                    height: "11px",
                                    border: "1px solid rgba(255,255,255,0.5)",
                                    borderRadius: "3px",
                                    background: "#4cd964",
                                    flexShrink: 0,
                                    marginLeft: "auto",
                                }} />
                            </div>

                            {/* Screen content */}
                            {showMenu ? (
                                /* Menu screen */
                                <div style={{
                                    flex: 1,
                                    background: "#f0f0e8",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    gap: "10px",
                                    padding: "12px 14px",
                                }}>
                                    {MENU_BUTTONS.map((btn, i) => {
                                        const isHovered = hoveredButton === i;
                                        return (
                                            <div
                                                key={i}
                                                onClick={() => {
                                                    setSelectedRange(btn.range);
                                                    setShowMenu(false);
                                                    setHoveredRow(null);
                                                    fetchRange(btn.range);
                                                }}
                                                onMouseEnter={() => setHoveredButton(i)}
                                                onMouseLeave={() => setHoveredButton(null)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    padding: "0 10px",
                                                    height: "44px",
                                                    border: "1.5px solid #1a1a1a",
                                                    borderRadius: "0",
                                                    background: isHovered ? "#2a5cad" : "#ffffff",
                                                    cursor: "pointer",
                                                    boxSizing: "border-box",
                                                }}
                                            >
                                                <CalendarIcon color={isHovered ? "#ffffff" : "#000000"} />
                                                <span style={{
                                                    flex: 1,
                                                    textAlign: "center",
                                                    fontSize: "14px",
                                                    fontWeight: 700,
                                                    color: isHovered ? "#ffffff" : "#000000",
                                                    fontFamily: "'Helvetica Neue', sans-serif",
                                                    letterSpacing: "0.01em",
                                                }}>{btn.label}</span>
                                                <CalendarIcon color={isHovered ? "#ffffff" : "#000000"} />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Track list — user scrollable */
                                <div className="ipod-tracklist" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                                    {loading && (
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "13px", color: "#555555", fontFamily: "'Helvetica Neue', sans-serif" }}>
                                            Loading...
                                        </div>
                                    )}
                                    {error && !loading && (
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "13px", color: "#cc0000", fontFamily: "'Helvetica Neue', sans-serif" }}>
                                            Error loading data
                                        </div>
                                    )}
                                    {!loading && !error && tracks.map((track, i) => {
                                        const isHovered = hoveredRow === i;
                                        return (
                                            <div
                                                key={i}
                                                className="mp-row"
                                                onClick={() => { setSelectedTrack(track); pendingTrackRef.current = track; }}
                                                onMouseEnter={() => setHoveredRow(i)}
                                                onMouseLeave={() => setHoveredRow(null)}
                                                style={{
                                                    height: "32px",
                                                    padding: "3px 6px 3px 8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                    position: "relative",
                                                    overflow: "hidden",
                                                    background: isHovered
                                                        ? "rgba(200,160,80,0.18)"
                                                        : i % 2 === 1
                                                            ? "rgba(0,0,0,0.04)"
                                                            : "transparent",
                                                    boxShadow: isHovered ? "inset 0 0 0 1px rgba(200,160,80,0.35)" : "none",
                                                    boxSizing: "border-box",
                                                    cursor: "pointer",
                                                    transition: "background 120ms ease, box-shadow 120ms ease",
                                                }}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={track.albumCoverUrl}
                                                    alt=""
                                                    style={{ width: "27px", height: "27px", borderRadius: "3px", objectFit: "cover", flexShrink: 0 }}
                                                />
                                                <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: "13px",
                                                        fontWeight: 600,
                                                        color: isHovered ? "#5a3e00" : "#1a1a1a",
                                                        fontFamily: "'Helvetica Neue', sans-serif",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        lineHeight: "17px",
                                                    }}>{`${i + 1}. ${track.songName}`}</div>
                                                    <div style={{
                                                        fontSize: "12px",
                                                        fontWeight: 400,
                                                        color: isHovered ? "rgba(90,62,0,0.75)" : "#555555",
                                                        fontFamily: "'Helvetica Neue', sans-serif",
                                                        paddingLeft: "16px",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        lineHeight: "15px",
                                                    }}>{track.artistName}</div>
                                                </div>
                                                <div style={{
                                                    fontSize: "13px",
                                                    fontWeight: 500,
                                                    color: isHovered ? "#5a3e00" : "#1a1a1a",
                                                    fontFamily: "'Helvetica Neue', sans-serif",
                                                    flexShrink: 0,
                                                    marginLeft: "auto",
                                                }}>{formatDuration(track.durationMs)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gap between screen and wheel */}
                    <div style={{ height: "5px", flexShrink: 0, zIndex: 1 }} />

                    {/* Click Wheel Area */}
                    <div style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        zIndex: 1,
                    }}>
                        {/* Outer ring — 240px */}
                        <div style={{
                            width: "240px",
                            height: "240px",
                            borderRadius: "50%",
                            background: "linear-gradient(145deg, #c8c8c8 0%, #a0a0a0 50%, #b8b8b8 100%)",
                            boxShadow: "0 5px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            {/* MENU — hover to enlarge, click to toggle menu screen */}
                            <div
                                onClick={() => setShowMenu(v => !v)}
                                onMouseEnter={() => setMenuHovered(true)}
                                onMouseLeave={() => setMenuHovered(false)}
                                style={{
                                    position: "absolute",
                                    top: "13px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    fontSize: menuHovered ? "16px" : "12px",
                                    fontWeight: 700,
                                    color: "#555555",
                                    letterSpacing: "0.1em",
                                    fontFamily: "'Helvetica Neue', sans-serif",
                                    userSelect: "none",
                                    cursor: "pointer",
                                    transition: "font-size 0.12s ease",
                                    whiteSpace: "nowrap",
                                }}
                            >MENU</div>
                            {/* Skip back */}
                            <div style={{ position: "absolute", left: "13px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", color: "#555555", userSelect: "none" }}>⏮</div>
                            {/* Skip forward */}
                            <div style={{ position: "absolute", right: "13px", top: "50%", transform: "translateY(-50%)", fontSize: "15px", color: "#555555", userSelect: "none" }}>⏭</div>
                            {/* Play/pause */}
                            <div style={{ position: "absolute", bottom: "13px", left: "50%", transform: "translateX(-50%)", fontSize: "15px", color: "#555555", userSelect: "none" }}>▶ ⏸</div>
                            {/* Center button — 80px */}
                            <div style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "50%",
                                background: "linear-gradient(145deg, #d0d0d0 0%, #b0b0b0 100%)",
                                boxShadow: "0 3px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)",
                                outline: "1px solid rgba(0,0,0,0.12)",
                            }} />
                        </div>
                    </div>
                </div>

                <style>{`
                .ipod-tracklist::-webkit-scrollbar { width: 5px; }
                .ipod-tracklist::-webkit-scrollbar-track { background: rgba(0,0,0,0.06); }
                .ipod-tracklist::-webkit-scrollbar-thumb { background: #2a5cad; border-radius: 3px; }
                .ipod-tracklist::-webkit-scrollbar-thumb:hover { background: #1e4a9a; }

                @keyframes mp-toast-in {
                    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
            </div>{/* end left panel */}

            {/* Toast notifications — top-right, above record player */}
            {toasts.length > 0 && (
                <div style={{
                    position: "fixed", top: "20px", right: "20px",
                    zIndex: 400,
                    display: "flex", flexDirection: "column", gap: "8px",
                    pointerEvents: "none",
                }}>
                    {toasts.map(toast => {
                        const ac = toast.type === "success" ? "74,222,128"
                            : toast.type === "warn" ? "250,204,21"
                                : toast.type === "error" ? "248,113,113"
                                    : "200,160,80";
                        return (
                            <div key={toast.id}
                                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                                style={{
                                    pointerEvents: "auto",
                                    minWidth: "240px", maxWidth: "340px",
                                    background: "rgba(8,8,16,0.88)",
                                    backdropFilter: "blur(20px)",
                                    border: `1px solid rgba(${ac},0.25)`,
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                                    cursor: "pointer",
                                    animation: "mp-toast-in 220ms cubic-bezier(0.16,1,0.3,1)",
                                }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 13px" }}>
                                    <span style={{ fontSize: "12px", color: `rgb(${ac})`, flexShrink: 0, fontWeight: 700 }}>
                                        {toast.type === "success" ? "✓" : toast.type === "warn" ? "⚠" : toast.type === "error" ? "✕" : "◌"}
                                    </span>
                                    <span style={{
                                        fontFamily: "'Helvetica Neue', sans-serif",
                                        fontSize: "12px", fontWeight: 500,
                                        color: "rgba(232,213,176,0.92)",
                                        lineHeight: 1.4, flex: 1,
                                    }}>{toast.message}</span>
                                </div>
                                <div style={{ height: "2px", background: `rgba(${ac},0.35)` }} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Right panel — record player */}
            {selectedTrack && (
                <div style={{
                    flex: 1,
                    height: "100vh",
                    position: "sticky",
                    top: 0,
                }}>
                    <RecordPlayerScene
                        albumCoverUrl={selectedTrack.albumCoverUrl}
                        songName={selectedTrack.songName}
                        artistName={selectedTrack.artistName}
                        onPhase3={() => {
                            if (pendingTrackRef.current) handlePlay(pendingTrackRef.current);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
