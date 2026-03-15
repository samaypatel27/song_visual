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
};
