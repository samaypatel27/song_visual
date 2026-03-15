import NextAuth, { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

export const authOptions: NextAuthOptions = {
    providers: [
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID!,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async redirect({ url, baseUrl }) {
            // Redirect to /dashboard after a successful sign-in
            if (url === baseUrl || url === `${baseUrl}/`) {
                return `${baseUrl}/dashboard`;
            }
            return url.startsWith(baseUrl) ? url : `${baseUrl}/dashboard`;
        },
    },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
