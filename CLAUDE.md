# CLAUDE.md — Song Visual

> **Read this file first.** This document provides a complete overview of the project — architecture, file purposes, data flows, and conventions. Update this file before every commit.

---

## Project Overview

**Song Visual** is a Spotify playlist visualization app. Users log in with Spotify OAuth, browse their playlists, then view a playlist as an interactive 3D album sleeve wall. Clicking an album zooms the camera in, slides the vinyl record out of the sleeve, and opens a track list panel on the right. The app also includes a Hall of Fame page with a circular album gallery and artist leaderboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.2.3 (App Router) |
| UI | React 19.0.0 |
| Language | TypeScript 5 |
| 3D Rendering | three.js 0.183.2 + @react-three/fiber 9.5.0 + @react-three/drei 10.7.7 |
| Auth | next-auth 4.24.11 (Spotify OAuth) |
| Styling | Inline CSS + Tailwind CSS v4 (via `@tailwindcss/postcss`) + shadcn/ui CSS vars |
| Shaders | GLSL (custom fragment shaders via drei's `<shaderMaterial>`) |

---

## Project Structure

```
song_visual/
├── CLAUDE.md                                  ← this file
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.js                          ← Tailwind v4 PostCSS plugin config
├── .env                                       ← Spotify credentials + NextAuth secret (never commit)
└── src/
    ├── app/
    │   ├── globals.css                        ← Tailwind v4 directives + shadcn CSS variable tokens
    │   ├── layout.tsx                         ← Root layout, imports globals.css, Inter font
    │   ├── page.tsx                           ← Login page (Spotify sign-in button)
    │   ├── providers.tsx                      ← SessionProvider wrapper for next-auth
    │   ├── dashboard/
    │   │   └── page.tsx                       ← Playlist grid view
    │   ├── playlist/
    │   │   └── [id]/
    │   │       └── page.tsx                   ← 3D vinyl wall for a single playlist
    │   ├── hall-of-fame/
    │   │   └── page.tsx                       ← Hall of Fame: circular album gallery + artist leaderboard
    │   ├── most-played/
    │   │   └── page.tsx                       ← iPod-style most-played tracks view
    │   └── api/
    │       ├── auth/[...nextauth]/
    │       │   └── route.ts                   ← NextAuth route handler
    │       └── spotify/
    │           ├── playlists/route.ts         ← GET user's playlists
    │           ├── playlist-tracks/[id]/route.ts ← GET paginated tracks for a playlist
    │           ├── album-tracks/[albumId]/route.ts ← GET album tracks (unused by UI)
    │           ├── top-artists/route.ts       ← GET top 10 artists (short_term) with genres/followers/popularity
    │           ├── top-tracks/route.ts        ← GET top 50 tracks + recent play counts
    │           ├── top-albums/route.ts        ← GET top 12 albums (long_term), deduped by albumId
    │           ├── most-played/route.ts       ← GET top 25 tracks by time range
    │           └── play/route.ts              ← POST playback control endpoint
    ├── components/
    │   ├── VinylScene.tsx                     ← Main 3D scene, camera zoom, album placement
    │   ├── AlbumCover.tsx                     ← Individual album sleeve + vinyl disc mesh
    │   ├── VinylRecord.tsx                    ← Spinning vinyl record geometry
    │   ├── TrackListPanel.tsx                 ← Right-side track list, color extraction, shader BG
    │   ├── DPadControls.tsx                   ← D-pad navigation overlay (HTML, not 3D)
    │   ├── ShaderBackground.tsx               ← Full-screen GLSL blob shader (unused/commented out)
    │   ├── HallOfFameScene.tsx                ← 3D artist plaques + vinyl crates scene (not used in current page)
    │   ├── ArtistPlaque.tsx                   ← Premium award plaque geometry (not used in current page)
    │   ├── VinylCrate.tsx                     ← Wooden crate with fan-spread vinyl records (not used in current page)
    │   ├── SpinningDisc.tsx                   ← Spinning disc animation component
    │   ├── ArtistLeaderboard.tsx              ← Top 10 artists leaderboard (used on hall-of-fame page)
    │   └── ui/
    │       └── circular-gallery.tsx           ← 3D circular carousel component (shadcn/ui component path)
    └── lib/
        ├── auth.ts                            ← NextAuth config (Spotify scopes, token refresh)
        ├── cache.ts                           ← In-memory MemoryCache class with TTL + sweep
        └── utils.ts                           ← shadcn cn() utility (clsx + tailwind-merge)
```

---

## File-by-File Reference

### `src/app/globals.css`
Tailwind v4 entry point (`@import "tailwindcss"`). Contains all shadcn/ui CSS variable tokens (oklch color values for `--background`, `--foreground`, `--card`, `--border`, etc.) in both `:root` (light) and `.dark` variants. Also wires them to Tailwind's `@theme inline` block so classes like `border-border`, `bg-card`, `text-muted-foreground` resolve correctly.

### `src/app/layout.tsx`
Root layout. Imports `globals.css`, loads Inter via `next/font/google`, wraps all pages in `<Providers>`.

### `src/app/providers.tsx`
Client component. Wraps children with `SessionProvider` so `useSession()` works anywhere.

### `src/app/page.tsx` — Login Page
- Shows a Spotify green (#1DB954) sign-in button
- Uses `signIn("spotify")` from next-auth/react
- Redirects authenticated users to `/dashboard`

### `src/app/dashboard/page.tsx` — Playlist Grid
- Fetches from `/api/spotify/playlists`
- Renders playlist cards in a 12-column grid
- Shimmer loading state
- Sign-out button

### `src/app/playlist/[id]/page.tsx` — 3D Playlist View
Z-index composition:
1. `z=1` — `<VinylScene>` (three.js canvas, fills screen)
2. `z=10` — `<TrackListPanel>` (right 32vw, slides in from right)
3. `z=20` — `<DPadControls>` (bottom-right corner overlay)

Passes selected album tracks to `TrackListPanel` via `handleAlbumExpand` callback from `VinylScene`.

### `src/app/hall-of-fame/page.tsx` — Hall of Fame
Two-section scroll layout:
1. **Section 1 (750vh scroll space, sticky 100vh viewport):** `CircularGallery` showing user's all-time top albums. Scroll drives Y-rotation (415° total over full scroll height). Auto-rotates at speed 0.15 when not scrolling. Tilt: −12° (front dips down, back rises).
2. **Section 2 (100vh):** `ArtistLeaderboard` — top 10 artists table.
- Back button (fixed, bottom-left)
- No D-pad

### `src/app/most-played/page.tsx` — Most Played
iPod-era brushed-metal UI showing top 25 tracks with time range selector (Last 4 Weeks / Last 6 Months / All Time).

### `src/app/api/auth/[...nextauth]/route.ts`
NextAuth catch-all handler. Delegates to `authOptions` from `src/lib/auth.ts`.

### `src/app/api/spotify/playlists/route.ts`
- `GET` — returns `{ playlists: [{ id, name }] }`
- Cached 5 minutes per token prefix via `MemoryCache`

### `src/app/api/spotify/playlist-tracks/[id]/route.ts`
- `GET ?limit=50&offset=0` — returns paginated track page
- Track shape: `{ trackId, trackName, albumId, albumName, albumCoverUrl, trackNumber, durationMs }`
- Cached 60 seconds per page

### `src/app/api/spotify/top-artists/route.ts`
- `GET` — returns `{ artists: ArtistData[] }` (top 10, `short_term`)
- `ArtistData`: `{ artistId, artistName, artistImageUrl, rank, genres, followers, popularity }`
- Cached 60 seconds (module-level Map)

### `src/app/api/spotify/top-tracks/route.ts`
- `GET` — top 50 tracks cross-referenced with recently-played for play counts
- `TrackData`: `{ trackId, trackName, artistName, albumName, albumCoverUrl, rank, recentPlayCount, albumId }`
- Cached 60 seconds

### `src/app/api/spotify/top-albums/route.ts`
- `GET` — top 12 albums derived from `long_term` top-50 tracks
- Deduplicates by `albumId`, sorts by number of top-50 tracks per album
- Returns `{ albums: AlbumGalleryItem[] }` where `AlbumGalleryItem` matches `GalleryItem` from `circular-gallery.tsx`
- Cached 60 seconds via `MemoryCache` keyed by token prefix

### `src/app/api/spotify/most-played/route.ts`
- `GET ?time_range=short_term|medium_term|long_term` — top 25 tracks for time range

### `src/lib/auth.ts` — NextAuth Config
- Spotify provider with scopes: `user-read-email`, `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`
- Token auto-refresh 60s before expiry
- Post-login redirect: `/dashboard`

### `src/lib/cache.ts` — MemoryCache
- `set(key, value, ttlMs)` / `get(key)` — lazy expiry on read
- Periodic sweep every 60s; interval is `unref()`'d
- Per-user isolation: key includes first 16 chars of access token

### `src/components/ui/circular-gallery.tsx` — Circular Gallery
3D CSS carousel component. Props:
- `items: GalleryItem[]` — `{ common, binomial, photo: { url, text, pos?, by } }`
- `radius` — distance of cards from center (default 600px)
- `autoRotateSpeed` — degrees per frame when not scrolling (default 0.02)
- `tilt` — rotateX in degrees applied before Y-spin (default 20; negative = front dips down)

Scroll drives rotation via `window.scrollY / scrollableHeight * 415`. Auto-rotates via `requestAnimationFrame` when not scrolling.

### `src/components/ArtistLeaderboard.tsx` — Artist Leaderboard
Fetches `/api/spotify/top-artists` and renders a styled table of top 10 artists. Columns: rank, avatar, name, genre, followers, popularity bar. Rank 1/2/3 highlighted in gold/silver/bronze. Hover highlights row and turns popularity bar Spotify green. Shimmer skeleton while loading.

### `src/components/VinylScene.tsx` — Core 3D Scene
- Fetches all playlist tracks page-by-page (50 per chunk)
- Groups by `albumId`, places on 120×70 unit wall with collision detection
- Ref-based zoom state; frustum culling via module-level singletons

### `src/components/AlbumCover.tsx` — Album Sleeve + Vinyl
- BoxGeometry sleeve + CylinderGeometry disc
- Hover: scale 1.1×, jiggle ±8°, float +0.1
- Golden ratio phase offsets (1.618) prevent animation aliasing

### `src/components/HallOfFameScene.tsx`
3D scene with artist plaques and vinyl crates. Canvas now uses `position: absolute` within a `position: relative` wrapper (so it works inside a scroll layout). **Not currently rendered on any page** — kept for future use.

### `src/components/ArtistPlaque.tsx`
Tier-based award plaques (24k Gold → Cobalt Steel). **Not currently rendered.** Available for future use.

### `src/components/VinylCrate.tsx`
Wooden crate with fan-spread album vinyl records (up to 12 per crate). **Not currently rendered.** Available for future use.

### `src/components/DPadControls.tsx`
5-button HTML D-pad overlay. Used on playlist page; removed from hall-of-fame page.

### `src/components/TrackListPanel.tsx`
Right-side panel with track list, color extraction from album art, GLSL noise background.

### `src/components/ShaderBackground.tsx`
Full-screen GLSL simplex noise background. **Currently unused.**

---

## Data Flow

```
Hall of Fame page:
  → Fetches /api/spotify/top-albums (long_term top 50 → deduped albums)
  → CircularGallery renders album covers in rotating 3D carousel
  → User scrolls 750vh → gallery rotates 415° total
  → ArtistLeaderboard section appears; fetches /api/spotify/top-artists

Playlist page:
  → VinylScene fetches /api/spotify/playlist-tracks/[id] paginated
  → Albums placed on wall; user clicks → camera zooms, disc slides, TrackListPanel opens
```

---

## Styling Architecture

- **Tailwind v4** — configured via `@tailwindcss/postcss` in `postcss.config.js`. No `tailwind.config.js` (v4 is CSS-first).
- **shadcn/ui tokens** — CSS variables defined in `globals.css` using oklch (luma preset). Wired to Tailwind via `@theme inline`.
- **Inline CSS** — all page/3D component styles. Tailwind classes used in `circular-gallery.tsx` and `globals.css` base layer.
- Existing inline styles throughout the app are unaffected by Tailwind.

---

## Caching Strategy

| Data | TTL | Scope |
|---|---|---|
| User playlists | 5 min | Per access token (first 16 chars) |
| Playlist tracks (per page) | 60 sec | Module-level Map, per page key |
| Top artists | 60 sec | Module-level Map |
| Top tracks | 60 sec | Module-level Map |
| Top albums | 60 sec | MemoryCache, per token prefix |

---

## Environment Variables (`.env`)

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

**Never commit `.env`.** It is in `.gitignore`.

---

## Key Architectural Decisions

1. **Ref-based zoom state** — Prevents React re-renders during camera animations; all animation runs in `useFrame`.
2. **Module-level singletons** (`Matrix4`, `Sphere`, `Frustum`) — Avoids GC pressure from allocating new objects every frame.
3. **Golden ratio phase offsets** — Incommensurable animation frequencies prevent visual aliasing between jiggle/micro/float cycles.
4. **Chunk accumulation via ref** — `playlistTracksByAlbumRef` survives pagination, no secondary API call per album when user clicks.
5. **Canvas color extraction** — 32×32 downsampled canvas sampling, no external library.
6. **Tailwind v4 CSS-first setup** — No config file; `@import "tailwindcss"` + `@theme inline` in `globals.css` is the entire configuration.
7. **HallOfFameScene canvas: absolute not fixed** — Changed so the 3D scene works as a flow element inside a multi-section scroll layout.
8. **`renderOrder=-1` on disc** — Forces correct depth ordering (disc renders behind sleeve geometry).

---

## Branch & Commit Convention

- Main branch: `main`
- Feature branches named descriptively (e.g., `loading-skeleton`, `zoom_feature`, `hall-of-fame`)
- PRs are merged into `main`

---

## Last Updated

- **Date:** 2026-04-07
- **Branch:** hall-of-fame
- **Last commit:** f8c851b — circular gallery + artist leaderboard on hall-of-fame page
