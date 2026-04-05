"use client";

import { useEffect, useState } from "react";

interface Track {
    songName: string;
    albumName: string;
    albumCoverUrl: string;
    artistName: string;
    durationMs: number;
}

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
    short_term:  "LAST 4 WEEKS",
    medium_term: "LAST 6 MONTHS",
    long_term:   "ALL TIME",
};

const MENU_BUTTONS: { label: string; range: TimeRange }[] = [
    { label: "Last 4 Weeks",  range: "short_term"  },
    { label: "Last 6 Months", range: "medium_term" },
    { label: "All Time",      range: "long_term"   },
];

export default function MostPlayedPage() {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedRange, setSelectedRange] = useState<TimeRange>("short_term");
    const [showMenu, setShowMenu] = useState(false);
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [menuHovered, setMenuHovered] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<number | null>(null);

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
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(ellipse at center, #ede9e1 0%, #d8d4cc 100%)",
            backgroundColor: "#e8e4dc",
            padding: "40px 0",
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
                                            onMouseEnter={() => setHoveredRow(i)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                            style={{
                                                height: "32px",
                                                padding: "3px 8px",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                                background: isHovered
                                                    ? "#2a5cad"
                                                    : i % 2 === 1
                                                        ? "rgba(0,0,0,0.04)"
                                                        : "transparent",
                                                boxSizing: "border-box",
                                                cursor: "default",
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
                                                    color: isHovered ? "#ffffff" : "#1a1a1a",
                                                    fontFamily: "'Helvetica Neue', sans-serif",
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    lineHeight: "17px",
                                                }}>{`${i + 1}. ${track.songName}`}</div>
                                                <div style={{
                                                    fontSize: "12px",
                                                    fontWeight: 400,
                                                    color: isHovered ? "rgba(255,255,255,0.85)" : "#555555",
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
                                                color: isHovered ? "#ffffff" : "#1a1a1a",
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
                .ipod-tracklist::-webkit-scrollbar {
                    width: 5px;
                }
                .ipod-tracklist::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.06);
                }
                .ipod-tracklist::-webkit-scrollbar-thumb {
                    background: #2a5cad;
                    border-radius: 3px;
                }
                .ipod-tracklist::-webkit-scrollbar-thumb:hover {
                    background: #1e4a9a;
                }
            `}</style>
        </div>
    );
}
