import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

// Extend NextAuth types so accessToken is recognised everywhere
declare module "next-auth" {
    interface Session {
        accessToken?: string;
    }
}
declare module "next-auth/jwt" {
    interface JWT {
        accessToken?: string;
    }
}

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
            // On first sign-in, `account` contains the Spotify access token
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
            session.accessToken = token.accessToken;
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
