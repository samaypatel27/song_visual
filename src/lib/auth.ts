// NOTE: Any time scopes are changed, users must re-authenticate.
// Existing tokens will NOT gain new scopes retroactively.
import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

// ── Extended types ─────────────────────────────────────────────────────────
declare module "next-auth" {
    interface Session {
        accessToken?: string;
        error?: string;
    }
}
declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number; // Unix timestamp (seconds)
        error?: string;
    }
}

// ── Token refresh helper ───────────────────────────────────────────────────
// Spotify access tokens expire after 3600 seconds (1 hour).
// This calls the Spotify token endpoint with the stored refresh_token to
// get a new access_token without requiring the user to re-login.
async function refreshAccessToken(token: JWT): Promise<JWT> {
    const basicAuth = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: token.refreshToken ?? "",
        }),
    });

    const refreshed = await res.json();

    if (!res.ok) {
        console.error("[auth] Token refresh failed:", refreshed);
        return { ...token, error: "RefreshAccessTokenError" };
    }

    console.log("[auth] Access token refreshed successfully");
    return {
        ...token,
        accessToken: refreshed.access_token,
        // Spotify may or may not return a new refresh_token; keep the old one as fallback
        refreshToken: refreshed.refresh_token ?? token.refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
        error: undefined,
    };
}

// ── Auth options ───────────────────────────────────────────────────────────
export const authOptions: NextAuthOptions = {
    providers: [
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID!,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: [
                        "user-read-email",
                        "user-read-private",
                        "playlist-read-private",
                        "playlist-read-collaborative",
                    ].join(" "),
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account }) {
            // First sign-in — store access_token, refresh_token, and expiry
            if (account) {
                return {
                    ...token,
                    accessToken: account.access_token,
                    refreshToken: account.refresh_token,
                    // account.expires_at is a Unix timestamp (seconds)
                    expiresAt: account.expires_at,
                };
            }

            // Token is still valid (with a 60-second buffer before actual expiry)
            if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
                return token;
            }

            // Token has expired — try to refresh it
            console.log("[auth] Access token expired, attempting refresh...");
            return refreshAccessToken(token);
        },

        async session({ session, token }: { session: Session; token: JWT }) {
            session.accessToken = token.accessToken;
            // Propagate any refresh error so the UI can handle it
            if (token.error) session.error = token.error;
            return session;
        },

        async redirect({ url, baseUrl }) {
            if (url === baseUrl || url === `${baseUrl}/`) {
                return `${baseUrl}/dashboard`;
            }
            return url.startsWith(baseUrl) ? url : `${baseUrl}/dashboard`;
        },
    },
};
