"use client";

import { signIn } from "next-auth/react";

export default function HomePage() {
    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                fontFamily: "sans-serif",
                gap: "1rem",
            }}
        >
            <h1>Song Visual</h1>
            <button
                onClick={() => signIn("spotify", { callbackUrl: "/dashboard" })}
                style={{
                    padding: "0.75rem 2rem",
                    fontSize: "1rem",
                    backgroundColor: "#1DB954",
                    color: "#fff",
                    border: "none",
                    borderRadius: "9999px",
                    cursor: "pointer",
                }}
            >
                Log in with Spotify
            </button>
        </main>
    );
}
