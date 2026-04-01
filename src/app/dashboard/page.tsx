"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Playlist {
    id: string;
    name: string;
}

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dev tools state
    const [trackId, setTrackId] = useState("");
    const [playStatus, setPlayStatus] = useState<{ type: "success" | "warn" | "error"; msg: string } | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Redirect unauthenticated users to home
    useEffect(() => {
        if (status === "unauthenticated") router.replace("/");
    }, [status, router]);

    // Fetch playlists once session is ready
    useEffect(() => {
        if (status !== "authenticated") return;

        fetch("/api/spotify/playlists")
            .then((res) => {
                if (!res.ok) throw new Error(`Error ${res.status}`);
                return res.json();
            })
            .then((data) => setPlaylists(data.playlists))
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, [status]);

    const handlePlay = async () => {
        if (!trackId.trim()) return;
        setIsPlaying(true);
        setPlayStatus(null);
        try {
            const res = await fetch("/api/spotify/play", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ trackId: trackId.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                const deviceLabel = data.device ? ` on ${data.device}` : "";
                setPlayStatus({ type: "success", msg: `✓ Playing${deviceLabel}` });
            } else if (data.error === "reauth_required") {
                setPlayStatus({ type: "error", msg: "✗ Session missing playback scope — sign out and sign back in, then retry." });
            } else if (data.error === "no_available_device") {
                setPlayStatus({ type: "warn", msg: "⚠ No Spotify devices found — open Spotify on your phone, desktop, or web player first" });
            } else if (data.error === "no_active_device") {
                setPlayStatus({ type: "warn", msg: "⚠ Device disappeared mid-request — try again" });
            } else if (data.error === "premium_required") {
                setPlayStatus({ type: "error", msg: "✗ Spotify Premium required" });
            } else {
                setPlayStatus({ type: "error", msg: `✗ Error: ${data.message ?? data.error ?? "Unknown error"}` });
            }
        } catch (e: any) {
            setPlayStatus({ type: "error", msg: `✗ Error: ${e.message}` });
        } finally {
            setIsPlaying(false);
        }
    };

    if (status === "loading" || status === "unauthenticated") return null;

    return (
        <main style={styles.page}>
            <header style={styles.header}>
                <div>
                    <h1 style={styles.title}>Your Playlists</h1>
                    <p style={styles.sub}>{session?.user?.email}</p>
                </div>
                <button style={styles.signOut} onClick={() => signOut({ callbackUrl: "/" })}>
                    Sign out
                </button>
            </header>

            {loading && <p style={styles.status}>Loading playlists…</p>}
            {error && <p style={{ ...styles.status, color: "#e53e3e" }}>Error: {error}</p>}

            {!loading && !error && (
                <ul style={styles.grid}>
                    {playlists.map((pl) => (
                        <li key={pl.id} style={styles.card}>
                            <Link
                                href={`/playlist/${pl.id}`}
                                style={{ display: "block", color: "inherit", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                                {pl.name}
                            </Link>
                        </li>
                    ))}
                    {playlists.length === 0 && (
                        <p style={styles.status}>No playlists found.</p>
                    )}
                </ul>
            )}

            {/* Dev Tools — collapsed by default */}
            <hr style={styles.divider} />
            <details style={styles.devTools}>
                <summary style={styles.devSummary}>Dev Tools</summary>
                <div style={styles.devBody}>
                    <p style={styles.devLabel}>Playback Test</p>
                    {/* To test: open Spotify on any device (phone, desktop, web player at open.spotify.com)
                        THEN enter a track ID and click Play. The song will play on whichever device is active. */}
                    <div style={styles.devRow}>
                        <input
                            type="text"
                            value={trackId}
                            onChange={(e) => setTrackId(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handlePlay(); }}
                            placeholder="Enter Spotify Track ID..."
                            style={styles.devInput}
                        />
                        <button
                            onClick={handlePlay}
                            disabled={isPlaying || !trackId.trim()}
                            style={{
                                ...styles.devButton,
                                ...(isPlaying ? styles.devButtonDisabled : {}),
                            }}
                        >
                            {isPlaying ? "Playing..." : "Play"}
                        </button>
                    </div>
                    {playStatus && (
                        <p style={{
                            ...styles.devStatus,
                            color: playStatus.type === "success" ? "#1db954"
                                : playStatus.type === "warn" ? "#f6ad55"
                                : "#e53e3e",
                        }}>
                            {playStatus.msg}
                        </p>
                    )}
                </div>
            </details>
        </main>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        maxWidth: 800,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        fontFamily: "sans-serif",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "2rem",
    },
    title: {
        margin: 0,
        fontSize: "1.75rem",
    },
    sub: {
        margin: "0.25rem 0 0",
        color: "#666",
        fontSize: "0.9rem",
    },
    signOut: {
        padding: "0.45rem 1.1rem",
        fontSize: "0.85rem",
        background: "none",
        border: "1px solid #ccc",
        borderRadius: "6px",
        cursor: "pointer",
    },
    status: {
        color: "#555",
        textAlign: "center" as const,
        marginTop: "3rem",
    },
    grid: {
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "0.75rem",
    },
    card: {
        padding: "0.85rem 1rem",
        border: "1px solid #e2e2e2",
        borderRadius: "8px",
        fontSize: "0.9rem",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        background: "#fafafa",
    },
    // Dev tools
    divider: {
        border: "none",
        borderTop: "1px solid rgba(0,0,0,0.1)",
        margin: "2.5rem 0 1.5rem",
    },
    devTools: {
        marginBottom: "2rem",
    },
    devSummary: {
        cursor: "pointer",
        fontSize: "0.85rem",
        color: "#888",
        userSelect: "none" as const,
    },
    devBody: {
        marginTop: "1rem",
        display: "flex",
        flexDirection: "column" as const,
        gap: "0.6rem",
    },
    devLabel: {
        margin: 0,
        fontSize: "0.8em",
        opacity: 0.5,
        color: "#333",
    },
    devRow: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
    },
    devInput: {
        border: "1px solid rgba(0,0,0,0.2)",
        background: "#f9f9f9",
        color: "#111",
        borderRadius: "6px",
        padding: "8px 12px",
        width: "280px",
        fontSize: "0.85rem",
        outline: "none",
    },
    devButton: {
        background: "#1db954",
        color: "white",
        fontWeight: 600,
        borderRadius: "6px",
        padding: "8px 16px",
        cursor: "pointer",
        border: "none",
        fontSize: "0.85rem",
    },
    devButtonDisabled: {
        background: "#148a3c",
        cursor: "not-allowed",
        opacity: 0.7,
    },
    devStatus: {
        margin: 0,
        fontSize: "0.82rem",
    },
};
