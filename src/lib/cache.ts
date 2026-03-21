// IN-MEMORY CACHE WITH TTL
// Two-tier caching strategy:
//   1. Per-user playlist list   — TTL 5 minutes (playlists change infrequently)
//   2. Per-playlist track data  — TTL 10 minutes (track lists are even more stable)

// Keys are scoped by user access token hash to prevent cross-user data leaks.
// Stale entries are lazily evicted on read + periodically swept every 60 seconds.

interface CacheEntry<T> {
    data: T;
    expiresAt: number; // Unix ms
}

class MemoryCache {
    private store = new Map<string, CacheEntry<unknown>>();
    private sweepInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Periodic sweep — removes all expired entries every 60 seconds
        // to prevent unbounded memory growth from abandoned keys.
        if (typeof setInterval !== "undefined") {
            this.sweepInterval = setInterval(() => this.sweep(), 60_000);
            // Allow Node to exit even if interval is still active
            if (this.sweepInterval && "unref" in this.sweepInterval) {
                (this.sweepInterval as NodeJS.Timeout).unref();
            }
        }
    }

    /**
     * Retrieve a cached value. Returns `undefined` if the key is missing or
     * expired (expired entries are lazily deleted on access).
     */
    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }

        return entry.data as T;
    }

    /**
     * Store a value with an explicit TTL (in milliseconds).
     */
    set<T>(key: string, data: T, ttlMs: number): void {
        this.store.set(key, {
            data,
            expiresAt: Date.now() + ttlMs,
        });
    }

    /**
     * Remove all expired entries. Called automatically every 60 seconds.
     */
    private sweep(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}

// Module-level singleton survives across API route invocations within the same
// server process. In serverless environments each cold start gets a fresh cache,
// which is the expected (and safe) behaviour.
export const cache = new MemoryCache();

export const TTL = {
    PLAYLISTS: 5 * 60 * 1000,       // 5 minutes
    PLAYLIST_TRACKS: 10 * 60 * 1000, // 10 minutes
} as const;

// Key builders 
// Keys include a token prefix to scope data per-user without storing the full
// token in the key. Using the first 16 chars of the access token as a hash-like
// prefix is sufficient for cache isolation (not a security boundary).
export function playlistsKey(accessToken: string): string {
    return `playlists:${accessToken.slice(0, 16)}`;
}

export function playlistTracksKey(accessToken: string, playlistId: string): string {
    return `tracks:${accessToken.slice(0, 16)}:${playlistId}`;
}
