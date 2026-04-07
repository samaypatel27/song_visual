# CLAUDE.md — Song Visual

> **Read this file first.** This document provides a complete overview of the project — architecture, file purposes, data flows, and conventions. Update this file before every commit.

---

## Project Overview

**Song Visual** is a Spotify playlist visualization app. Users log in with Spotify OAuth, browse their playlists, then view a playlist as an interactive 3D album sleeve wall. Clicking an album zooms the camera in, slides the vinyl record out of the sleeve, and opens a track list panel on the right.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.2.3 (App Router) |
| UI | React 19.0.0 |
| Language | TypeScript 5 |
| 3D Rendering | three.js 0.183.2 + @react-three/fiber 9.5.0 + @react-three/drei 10.7.7 |
| Auth | next-auth 4.24.11 (Spotify OAuth) |
| Styling | Inline CSS / CSS-in-JS (no CSS framework) |
| Shaders | GLSL (custom fragment shaders via drei's `<shaderMaterial>`) |

---

## Project Structure

```
song_visual/
├── CLAUDE.md                                  ← this file
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env                                       ← Spotify credentials + NextAuth secret (never commit)
└── src/
    ├── app/
    │   ├── layout.tsx                         ← Root layout, wraps <Providers>
    │   ├── page.tsx                           ← Login page (Spotify sign-in button)
    │   ├── providers.tsx                      ← SessionProvider wrapper for next-auth
    │   ├── dashboard/
    │   │   └── page.tsx                       ← Playlist grid view
    │   ├── playlist/
    │   │   └── [id]/
    │   │       └── page.tsx                   ← 3D vinyl wall for a single playlist
    │   └── api/
    │       ├── auth/[...nextauth]/
    │       │   └── route.ts                   ← NextAuth route handler
    │       └── spotify/
    │           ├── playlists/route.ts         ← GET user's playlists
    │           ├── playlist-tracks/[id]/route.ts ← GET paginated tracks for a playlist
    │           └── album-tracks/[albumId]/route.ts ← GET album tracks (unused by UI)
    ├── components/
    │   ├── VinylScene.tsx                     ← Main 3D scene, camera zoom, album placement
    │   ├── AlbumCover.tsx                     ← Individual album sleeve + vinyl disc mesh
    │   ├── VinylRecord.tsx                    ← Spinning vinyl record geometry
    │   ├── TrackListPanel.tsx                 ← Right-side track list, color extraction, shader BG
    │   ├── DPadControls.tsx                   ← D-pad navigation overlay (HTML, not 3D)
    │   └── ShaderBackground.tsx               ← Full-screen GLSL blob shader (unused/commented out)
    └── lib/
        ├── auth.ts                            ← NextAuth config (Spotify scopes, token refresh)
        └── cache.ts                           ← In-memory MemoryCache class with TTL + sweep
```

---

## File-by-File Reference

### `src/app/layout.tsx`
Root layout. Wraps all pages in `<Providers>` (which supplies the next-auth `SessionProvider`). Sets global `<html>` + `<body>` attributes.

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

### `src/app/api/auth/[...nextauth]/route.ts`
NextAuth catch-all handler. Delegates to `authOptions` from `src/lib/auth.ts`.

### `src/app/api/spotify/playlists/route.ts`
- `GET` — returns `{ playlists: [{ id, name }] }`
- Cached 5 minutes per token prefix via `MemoryCache`
- Requires valid session with `accessToken`

### `src/app/api/spotify/playlist-tracks/[id]/route.ts`
- `GET ?limit=50&offset=0` — returns paginated track page
- Track shape: `{ trackId, trackName, albumId, albumName, albumCoverUrl, trackNumber, durationMs }`
- Skips null items, podcast episodes, tracks with no cover art
- Cached 60 seconds per page in a module-level `Map`

### `src/app/api/spotify/album-tracks/[albumId]/route.ts`
- Exists but **not used by the UI**
- Track data is accumulated from the playlist-tracks endpoint instead

### `src/lib/auth.ts` — NextAuth Config
- Spotify provider with scopes: `user-read-email`, `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`
- Token auto-refresh: Spotify tokens expire in 3600s; refreshed 60s before expiry
- Post-login redirect: `/dashboard`
- Session extended with `accessToken` field

### `src/lib/cache.ts` — MemoryCache
- `set(key, value, ttlMs)` / `get(key)` — lazy expiry on read
- Periodic sweep every 60s removes all stale entries (interval is `unref()`'d so it doesn't block process exit)
- Per-user isolation: cache key includes first 16 chars of access token

### `src/components/VinylScene.tsx` — Core 3D Scene
**Responsibilities:**
- Fetches all playlist tracks page-by-page (50 per chunk), accumulates into `playlistTracksByAlbumRef`
- Groups tracks by `albumId`, sorts by track count descending
- Places album covers on a 120×70 unit wall using collision detection (0.8-unit margin)
- Disc radius = `min(1.8 + (trackCount-1) × 0.45, 4.2)`
- Manages zoom state (ref-based, no re-renders): `active`, `collapsing`, `targetCamPos`, `lookAt`, `progress`
- Zoom math: card occupies 33% of screen; `distance = cardSize / (0.33 × 2 × tan(35°) × aspect)`, clamped to [5, 16]
- Disc slide starts at 92% zoom progress, reaches 72% visible at 100%
- Skeleton loading: 15 placeholder albums with pulsing opacity, fades out over 900ms once textures load
- Frustum culling: module-level `Matrix4`/`Sphere`/`Frustum` singletons reused each frame

### `src/components/AlbumCover.tsx` — Album Sleeve + Vinyl
**3D geometry:**
- Sleeve: `BoxGeometry` with 6 materials (front = album texture, sides/back = dark #1a1a1a/#2a2a2a, top/bottom = bevel highlight strips)
- Disc: `CylinderGeometry` + picture disc `CircleGeometry` (album texture) + 8 groove `TorusGeometry` rings + chrome label border + spindle hole + rim

**Animation (all via `useFrame`, no setState):**
- Idle: static
- Hover: scale 1.1×, jiggle ±8°, micro rotation ±2°, float +0.1
- Expanded: jiggle suppressed, float reduced
- Disc slide: position.x animates to −72% of card width

**Golden ratio phase offsets (1.618):** Jiggle (3s), micro (0.8s), float (4s) — incommensurable frequencies prevent aliasing

**Frustum culling:** World-space sphere vs camera frustum; skips all work if off-screen

### `src/components/VinylRecord.tsx`
Standalone vinyl disc geometry component. Used inside `AlbumCover`. Renders cylinder + picture disc + groove rings + chrome details.

### `src/components/TrackListPanel.tsx` — Track List
- Fixed right 32vw, 15vh top/bottom margin; slides in from right (translateX 110% → 0)
- Header: album name + track count badge
- Scrollable track rows (no scrollbar) with top/bottom mask gradients
- Per-row: track number, title (truncated), duration
- Hover: dash-dot grows to 44px glow, title shifts right, duration fades in
- **Color extraction:** draws album cover on 32×32 canvas, samples top-left + bottom-right quadrants, desaturates 40%, clamps HSL lightness [20–45%] → used for timeline gradient + dash color
- Shader background: 3D simplex noise + domain warping, dark navy → Spotify green animation (z=-1 behind text)
- Skeleton: 8 shimmer rows while loading

### `src/components/DPadControls.tsx` — D-Pad Navigation
- 5 HTML buttons (up/left/center-reset/right/down) in a fixed grid, bottom-right
- Updates `pressedDirection` ref (not state)
- `VinylScene` reads this ref in `useFrame` to pan camera when not zoomed
- Pan clamped: X ∈ [−12, 12], Y ∈ [−8, 8]

### `src/components/ShaderBackground.tsx`
- Full-screen GLSL fragment shader background
- 2D simplex noise → 3-octave FBM → domain warping → black/navy/Spotify-green gradient
- **Currently unused** (commented out in playlist page)

---

## Data Flow

```
User clicks playlist on /dashboard
  → /playlist/[id] page mounts
  → VinylScene starts paginated fetch: /api/spotify/playlist-tracks/[id]?limit=50&offset=0
  → Each page accumulated into playlistTracksByAlbumRef (Map<albumId, Track[]>)
  → Once all pages fetched, albums placed on wall, textures loaded, skeleton fades out
  → User clicks album
  → handleAlbumExpand called → tracks passed to TrackListPanel
  → Camera zooms, disc slides, TrackListPanel slides in from right
  → User clicks background → camera collapses back
```

---

## State Management Pattern

- **`useState`** — UI state only (playlists list, loading booleans, panel visibility)
- **`useRef`** — All animation state (zoom progress, camera targets, pressed direction, accumulated tracks). No re-renders during animation.
- **`useFrame`** — Per-frame mutations to Three.js object properties directly
- **Props** — Tracks passed from VinylScene → playlist page → TrackListPanel

---

## Caching Strategy

| Data | TTL | Scope |
|---|---|---|
| User playlists | 5 min | Per access token (first 16 chars) |
| Playlist tracks (per page) | 60 sec | Module-level Map, per page key |
| Album tracks (unused) | 5 min | Per album ID |

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
6. **No global CSS** — All styling is inline or CSS-in-JS for component encapsulation.
7. **`renderOrder=-1` on disc** — Forces correct depth ordering (disc renders behind sleeve geometry).

---

## Branch & Commit Convention

- Main branch: `main`
- Feature branches named descriptively (e.g., `loading-skeleton`, `zoom_feature`)
- PRs are merged into `main`

---

## Last Updated

<!-- AUTO-UPDATED BY PRE-COMMIT HOOK -->
- **Date:** 2026-04-07
- **Branch:** hall-of-fame
- **Last commit:** 3fb0536 — feat: initial commit


---

## Recent Git Log

<!-- AUTO-UPDATED BY PRE-COMMIT HOOK -->
```
3fb0536 feat: initial commit
f8c851b creating mp3 player logic for most played in x time. However, if we switch to apple music we cant use the logic
31e2535 minor
b27751e minor adjustments
ca951df created backend api and page for most played songs. Added bedroom for playlist vinyl records page
```
