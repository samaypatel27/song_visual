// ── DO NOT READ THIS FILE IN FULL UNLESS REQUIRED ──────────────────────────
// If the following details are enough for your task, stop here.
//
// FILE: src/components/VinylScene.tsx
// PURPOSE: The main 3D R3F scene rendered on the playlist detail page.
//   A full-viewport Canvas (position:fixed, pointer-events:auto) that renders
//   a wall of album covers, a record player, and handles camera zoom/pan.
//
// KEY SUB-COMPONENTS (all defined in this file):
//   AlbumCover      — individual 3D sleeve + vinyl disc (imports from AlbumCover.tsx)
//   RecordPlayer    — flat plane mesh at world [48, -23, -2.85] with record_player.png texture
//   WallBackground  — plane mesh with a wood/brick texture behind the album wall
//   ZoomController  — manages OrbitControls camera zoom-in on album click and zoom-out on collapse
//
// COORDINATE SYSTEM:
//   Camera: PerspectiveCamera, fov 70, position [0, 0, 30]
//   Album wall: albums laid out in a grid starting near world origin
//   Record player: centered at world [48, -23, -2.85], geometry [24, 19]
//   Platter center (visual): approx [47, -21.5, -2.85] based on PNG inspection
//
// STATE MACHINE (zoom):
//   idle → expanding (zoom-in to clicked album) → expanded (panel visible) → collapsing → idle
//   Managed via a single mutable ref object (z = zoom state) + setExpandedAlbumId
//
// EXPORTED:
//   VinylScene          (component)
//   PlaylistTrackEntry  (interface: { trackId, trackNumber, trackName, durationMs })
//   AlbumGroup          (interface: { albumId, albumName, albumCoverUrl, tracks[] })
//
// PROPS (VinylSceneProps):
//   playlistId          — Spotify playlist ID; drives the paginated track fetch
//   pressedDirection    — ref for D-pad camera pan direction
//   onAlbumExpand(albumId, albumName, albumCoverUrl, tracks[])  — fires on album click
//   onDiscSlide()       — fires when vinyl disc slides out (after zoom completes)
//   onCollapse()        — fires when zoom-out completes
//
// DATA LOADING: paginated GET /api/spotify/playlist-tracks?id=&offset=
//   Tracks are accumulated in-memory per album into albumGroupsRef (a Map).
//   New pages are fetched as the user pans (infinite scroll via isFetchingMore).
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState, useRef, memo, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { AlbumCover } from "./AlbumCover";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Track {
  trackId: string;
  trackName: string;
  albumId: string;
  albumName: string;
  albumCoverUrl: string;
  trackNumber: number;
  durationMs: number;
}

export interface PlaylistTrackEntry {
  trackId: string;
  trackNumber: number;
  trackName: string;
  durationMs: number;
}

export interface AlbumGroup {
  albumId: string;
  albumName: string;
  albumCoverUrl: string;
  trackCount: number;
  tracks: PlaylistTrackEntry[];
}

export interface VinylSceneProps {
  playlistId: string;
  roomType?: "study" | "bedroom";
  pressedDirection: React.MutableRefObject<
    "up" | "down" | "left" | "right" | "reset" | null
  >;
  onAlbumExpand?: (
    albumId: string,
    albumName: string,
    albumCoverUrl: string,
    tracks: PlaylistTrackEntry[]
  ) => void;
  onDiscSlide?: () => void;
  onCollapse?: () => void;
}

// ─── LAYOUT HELPERS ──────────────────────────────────────────────────────────

export const getDiscRadius = (trackCount: number): number =>
  Math.min(1.8 + (trackCount - 1) * 0.45, 4.2);

const WALL_WIDTH = 120;
const WALL_HEIGHT = 70;
const getCardSize = (trackCount: number) =>
  Math.min(1.8 + (trackCount - 1) * 0.45, 4.2) * 2;

const WALL_ASPECT = WALL_WIDTH / WALL_HEIGHT;

const generatePositions = (groups: AlbumGroup[], roomType: 'study' | 'bedroom' = 'study') => {
  const positions: { x: number; y: number; angle: number; scale: number; size: number }[] = [];
  const n = groups.length;
  if (n === 0) return positions;

  if (roomType === "bedroom") {
    // Playable area defined to avoid the bed: W=100, H=35, CenterY=12.5
    const W = 100;
    const H = 35;
    const centerY = 12.5;
    
    // Choose columns and rows that best match the aspect ratio roughly W/H (2.85)
    // to maximize coverage.
    const aspect = W / H;
    const cols = Math.max(1, Math.floor(Math.sqrt(n * aspect)));
    const rows = Math.ceil(n / cols);
    
    const paddingMultiplier = 0.15; // 15% padding
    const sizeX = W / (cols + (cols - 1) * paddingMultiplier);
    const sizeY = H / (rows + (rows - 1) * paddingMultiplier);
    const uniformSize = Math.min(sizeX, sizeY, 18); // limit maximum album size
    
    const stepX = uniformSize * (1 + paddingMultiplier);
    const stepY = uniformSize * (1 + paddingMultiplier);
    const totalGridWidth = cols * uniformSize + (cols - 1) * uniformSize * paddingMultiplier;
    const totalGridHeight = rows * uniformSize + (rows - 1) * uniformSize * paddingMultiplier;
    
    // Calculate top-left start positions
    const startX = -totalGridWidth / 2 + uniformSize / 2;
    const startY = centerY + totalGridHeight / 2 - uniformSize / 2;

    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * stepX;
      const y = startY - row * stepY;
      
      const group = groups[i];
      // Size equals base card size * scale. We want total rendered size to be uniformSize.
      const baseSize = getCardSize(group.trackCount);
      const scale = uniformSize / baseSize;
      
      // Shuffle slightly if we want, or exact grid. Here exact grid.
      positions.push({ x, y, angle: 0, scale, size: uniformSize });
    }
    return positions;
  }

  // --- "study" roomType (spiral / collision layout) ---
  const wallClamp = (x: number, y: number) => [
    Math.max(-WALL_WIDTH / 2 + 2, Math.min(WALL_WIDTH / 2 - 2, x)),
    Math.max(-WALL_HEIGHT / 2 + 2, Math.min(WALL_HEIGHT / 2 - 2, y)),
  ];

  for (let i = 0; i < n; i++) {
    const group = groups[i];
    // Deterministic random properties based on albumId
    let h = 0;
    for (let j = 0; j < group.albumId.length; j++)
      h = (Math.imul(31, h) + group.albumId.charCodeAt(j)) | 0;
    const r1 =
      (((Math.imul(h ^ 1, 2654435761) ^ (h >>> 16)) >>> 0) / 4294967296);
    const r2 =
      (((Math.imul(h ^ 2, 2654435761) ^ (h >>> 16)) >>> 0) / 4294967296);

    const scale = 1.1 + (r1 - 0.5) * 0.12;
    const size = getCardSize(group.trackCount) * scale;

    let collision = true;
    let placedX = 0,
      placedY = 0;
    let r = Math.max(
      0,
      Math.floor(Math.sqrt((i * 22) / (WALL_ASPECT * Math.PI))) - 1
    );
    const dr = 0.5;
    const angleOffset = r2 * Math.PI * 2;

    while (collision && r < 100) {
      const perimeter = r === 0 ? 1 : 4 * r * (WALL_ASPECT + 1);
      const numSamples = r === 0 ? 1 : Math.ceil(perimeter * 0.8);
      let foundSpot = false;

      for (let s = 0; s < numSamples; s++) {
        const theta = angleOffset + (s / numSamples) * Math.PI * 2;
        let u = Math.cos(theta);
        let v = Math.sin(theta);
        const max = Math.max(Math.abs(u), Math.abs(v));
        u /= max;
        v /= max;

        const x = r * WALL_ASPECT * u;
        const y = r * v;
        const [clampedX, clampedY] = wallClamp(x, y);

        let tempCollision = false;
        const margin = 0.8;
        for (const p of positions) {
          const dx = Math.abs(clampedX - p.x);
          const dy = Math.abs(clampedY - p.y);
          if (
            dx < (size + p.size) / 2 + margin &&
            dy < (size + p.size) / 2 + margin
          ) {
            tempCollision = true;
            break;
          }
        }

        if (!tempCollision) {
          foundSpot = true;
          placedX = clampedX;
          placedY = clampedY;
          collision = false;
          break;
        }
      }

      if (!foundSpot) r += dr;
    }

    if (collision) {
      placedX = (r1 - 0.5) * WALL_WIDTH;
      placedY = (r2 - 0.5) * WALL_HEIGHT;
    }

    positions.push({ x: placedX, y: placedY, angle: 0, scale, size });
  }
  return positions;
};

// ─────────────────────────────────────────────────────────────────────────────
// ZOOM STATE
// ─────────────────────────────────────────────────────────────────────────────

interface ZoomState {
  active: boolean;
  collapsing: boolean;
  targetCamPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  originalCamPos: THREE.Vector3;
  originalLookAt: THREE.Vector3;
  panSnapshot: THREE.Vector3; // live-updated each idle frame
  initialCamZ: number;
  initialDist: number;
  progress: number;
  loggedTrigger: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOOM CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

function ZoomController({
  zoomState,
  controlsRef,
  pressedDirection,
  onDiscSlide,
  onZoomComplete,
}: {
  zoomState: React.MutableRefObject<ZoomState>;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  pressedDirection: React.MutableRefObject<
    "up" | "down" | "left" | "right" | "reset" | null
  >;
  onDiscSlide: () => void;
  onZoomComplete: () => void;
}) {
  const { camera } = useThree();
  const ORIGIN = new THREE.Vector3(0, 0, 0);

  useFrame(() => {
    const ctrl = controlsRef.current;
    const z = zoomState.current;

    if (z.active) {
      camera.position.lerp(z.targetCamPos, 0.055);
      if (ctrl) ctrl.target.lerp(z.lookAt, 0.055);

      const remaining = camera.position.distanceTo(z.targetCamPos);
      z.progress = z.initialDist > 0 ? 1 - remaining / z.initialDist : 1;

      if (z.progress >= 0.92 && !z.loggedTrigger) {
        z.loggedTrigger = true;
        onDiscSlide();
      }
      if (ctrl) ctrl.update();
    } else if (z.collapsing) {
      camera.position.lerp(z.originalCamPos, 0.055);
      if (ctrl) ctrl.target.lerp(z.originalLookAt, 0.055);

      const remaining = camera.position.distanceTo(z.originalCamPos);
      if (remaining < 0.08) {
        camera.position.copy(z.originalCamPos);
        if (ctrl) {
          ctrl.target.copy(z.originalLookAt);
          ctrl.update();
        }
        z.collapsing = false;
        onZoomComplete();
      } else {
        if (ctrl) ctrl.update();
      }
    } else {
      // Idle: track current pan position so collapse can return here
      if (ctrl) z.panSnapshot.copy(ctrl.target);

      if (!ctrl) return;
      const dir = pressedDirection.current;
      if (dir) {
        const speed = 0.25;
        if (dir === "up") {
          ctrl.target.y += speed;
          ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -32, 32);
        }
        if (dir === "down") {
          ctrl.target.y -= speed;
          ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -32, 32);
        }
        if (dir === "left") {
          ctrl.target.x -= speed;
          ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -55, 55);
        }
        if (dir === "right") {
          ctrl.target.x += speed;
          ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -55, 55);
        }
        if (dir === "reset") ctrl.target.lerp(ORIGIN, 0.12);
        ctrl.update();
      }
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORIGIN CAPTURE — records initial lookAt once controls mount
// ─────────────────────────────────────────────────────────────────────────────

function OriginCapture({
  zoomState,
  controlsRef,
}: {
  zoomState: React.MutableRefObject<ZoomState>;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const captured = useRef(false);
  useFrame(() => {
    if (captured.current) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    zoomState.current.originalLookAt = ctrl.target.clone();
    captured.current = true;
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WALL BACKGROUND + RECORD PLAYER
// ─────────────────────────────────────────────────────────────────────────────

function WallBackground({ roomType = "study" }: { roomType?: "study" | "bedroom" }) {
  const texPath = roomType === "bedroom" ? "/bedroom.png" : "/Wall_Background.png";
  const tex = useTexture(texPath);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return (
    <mesh position={[0, 0, -3]}>
      <planeGeometry args={[120, 70]} />
      <meshStandardMaterial map={tex} roughness={0.85} metalness={0.0} />
    </mesh>
  );
}

function RecordPlayer() {
  const tex = useTexture("/record_player.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return (
    <mesh position={[48, -23, -2.85]}>
      <planeGeometry args={[24, 19]} />
      <meshStandardMaterial
        map={tex}
        transparent
        alphaTest={0.05}
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALBUMS READY SIGNAL
// ─────────────────────────────────────────────────────────────────────────────

function AlbumsReadySignal({ onReady }: { onReady: () => void }) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onReady();
    }
  }, [onReady]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADING PLACEHOLDERS
// ─────────────────────────────────────────────────────────────────────────────

// Representative track counts that give a realistic mix of album sizes.
// Repeated cyclically when count exceeds the pattern length.
const SKELETON_TRACK_PATTERN = [5, 10, 3, 8, 2, 7, 4, 12, 6, 3, 9, 2, 5, 8, 4];

function buildSkeletonLayout(count: number, roomType: "study" | "bedroom" = "study") {
  const groups: AlbumGroup[] = Array.from({ length: count }, (_, i) => ({
    albumId: `sk-${i}`,
    albumName: "",
    albumCoverUrl: "",
    trackCount: SKELETON_TRACK_PATTERN[i % SKELETON_TRACK_PATTERN.length],
    tracks: [],
  }));
  return generatePositions(groups, roomType);
}

// Default layout used before the first API response arrives (for SSR placeholder)
const DEFAULT_SKELETON_LAYOUT = buildSkeletonLayout(15, "study");

const SkeletonCover = memo(
  ({
    x,
    y,
    size,
    phaseOffset,
  }: {
    x: number;
    y: number;
    size: number;
    phaseOffset: number;
  }) => {
    const matRef = useRef<THREE.MeshStandardMaterial>(null);

    useFrame(({ clock }) => {
      if (!matRef.current) return;
      const t = Math.sin(clock.elapsedTime * 1.2 + phaseOffset) * 0.5 + 0.5;
      const v = 0.18 + t * 0.09;
      matRef.current.color.setRGB(v, v, v);
    });

    return (
      <mesh position={[x, y, 0.15]}>
        <boxGeometry args={[size, size, 0.12]} />
        <meshStandardMaterial
          ref={matRef}
          roughness={0.9}
          metalness={0.05}
          transparent
        />
      </mesh>
    );
  }
);
SkeletonCover.displayName = "SkeletonCover";

function SkeletonWall({ phase, layout }: { phase: "loading" | "exit"; layout: ReturnType<typeof buildSkeletonLayout> }) {
  const groupRef = useRef<THREE.Group>(null);
  const opRef = useRef(0);

  useFrame(({ clock }) => {
    if (phase === "exit") {
      opRef.current = THREE.MathUtils.lerp(opRef.current, 0, 0.05);
    } else {
      const pulse = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.8);
      opRef.current = THREE.MathUtils.lerp(opRef.current, pulse, 0.1);
    }
    if (!groupRef.current) return;
    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        (mesh.material as THREE.MeshStandardMaterial).opacity = opRef.current;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {layout.map((pos, i) => (
        <SkeletonCover
          key={i}
          x={pos.x}
          y={pos.y}
          size={pos.size}
          phaseOffset={i * 0.8}
        />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────────────────────────────────────

const MemoizedAlbumCover = memo(AlbumCover);

export function VinylScene({
  playlistId,
  roomType = "study",
  pressedDirection,
  onAlbumExpand,
  onDiscSlide,
  onCollapse,
}: VinylSceneProps) {
  const [albumGroups, setAlbumGroups] = useState<AlbumGroup[]>([]);
  const [positions, setPositions] = useState<{ x: number; y: number; scale: number }[]>([]);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [albumsReady, setAlbumsReady] = useState(false);
  const [skeletonLayout, setSkeletonLayout] = useState(() => buildSkeletonLayout(15, roomType));
  const handleAlbumsReady = useCallback(() => setAlbumsReady(true), []);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [discSlideActive, setDiscSlideActive] = useState(false);

  // Synchronize layout recalculation whenever roomType changes (also runs implicitly when data loads due to albumGroups changing)
  useEffect(() => {
    if (albumGroups.length > 0) {
      setPositions(generatePositions(albumGroups, roomType));
    }
    // ensure skeleton updates its layout as well behind the scenes
    setSkeletonLayout(buildSkeletonLayout(albumGroups.length || 15, roomType));
  }, [roomType, albumGroups]);

  const zoomState = useRef<ZoomState>({
    active: false,
    collapsing: false,
    targetCamPos: new THREE.Vector3(0, 0, 22),
    lookAt: new THREE.Vector3(0, 0, 0),
    originalCamPos: new THREE.Vector3(0, 0, 22),
    originalLookAt: new THREE.Vector3(0, 0, 0),
    panSnapshot: new THREE.Vector3(0, 0, 0),
    initialCamZ: 22,
    initialDist: 0,
    progress: 0,
    loggedTrigger: false,
  });

  // ── Fetch all playlist tracks ─────────────────────────────────────────────
  useEffect(() => {
    if (!playlistId) return;
    setAlbumsReady(false);
    setShowSkeleton(true);
    const controller = new AbortController();
    let isMounted = true;

    const loadData = async () => {
      try {
        let offset = 0;
        let limit = 50;
        let total = 1;
        const globalChunkMap = new Map<string, AlbumGroup>();
        let firstPage = true;

        while (offset < total && isMounted) {
          const res = await fetch(
            `/api/spotify/playlist-tracks/${playlistId}?limit=${limit}&offset=${offset}`,
            { signal: controller.signal }
          );
          if (!res.ok) throw new Error(String(res.status));

          const data = await res.json();
          total = data.total || 0;
          limit = data.limit || 50;
          if (!data.tracks) break;

          data.tracks.forEach((t: Track) => {
            const trackEntry: PlaylistTrackEntry = {
              trackId: t.trackId,
              trackNumber: t.trackNumber,
              trackName: t.trackName,
              durationMs: t.durationMs,
            };
            if (globalChunkMap.has(t.albumId)) {
              const group = globalChunkMap.get(t.albumId)!;
              group.trackCount++;
              group.tracks.push(trackEntry);
            } else {
              globalChunkMap.set(t.albumId, {
                albumId: t.albumId,
                albumName: t.albumName,
                albumCoverUrl: t.albumCoverUrl,
                trackCount: 1,
                tracks: [trackEntry],
              });
            }
          });

          // After the first page, estimate total album count and resize the skeleton
          if (firstPage && isMounted) {
            firstPage = false;
            const pageAlbumCount = globalChunkMap.size;
            const pageTrackCount = data.tracks.length;
            if (pageAlbumCount > 0 && pageTrackCount > 0) {
              const estimated = Math.max(
                pageAlbumCount,
                Math.round(pageAlbumCount * (total / pageTrackCount))
              );
              setSkeletonLayout(buildSkeletonLayout(estimated, roomType));
            }
          }

          offset += limit;
        }

        if (isMounted && globalChunkMap.size > 0) {
          const sortedGroups = Array.from(globalChunkMap.values()).sort(
            (a, b) => b.trackCount - a.trackCount
          );
          setAlbumGroups(sortedGroups);
          // the setPositions state is now fully reacting to albumGroups through a dedicated useEffect
        }
      } catch (err: any) {
        if (err.name !== "AbortError")
          console.error("[VinylScene] fetch error:", err);
      }
    };

    loadData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [playlistId]);

  // Unmount skeleton ~900ms after textures load (fade-out window)
  useEffect(() => {
    if (albumsReady) {
      const t = setTimeout(() => setShowSkeleton(false), 900);
      return () => clearTimeout(t);
    }
  }, [albumsReady]);

  // Escape key collapses expanded album
  useEffect(() => {
    if (!expandedAlbumId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedAlbumId]);

  // ── Click handler — compute camera zoom target ────────────────────────────
  const handleExpand = (
    albumId: string,
    albumName: string,
    albumCoverUrl: string,
    tracks: PlaylistTrackEntry[],
    cardWorldX: number,
    cardWorldY: number,
    trackCount: number
  ) => {
    if (expandedAlbumId === albumId) {
      collapse();
      return;
    }

    const cardSize = getCardSize(trackCount);
    const cardWorldPos = new THREE.Vector3(cardWorldX, cardWorldY, 0.1);

    const fovRad = 70 * (Math.PI / 180);
    const aspect = window.innerWidth / window.innerHeight;
    const tan35 = Math.tan(fovRad / 2);
    const rawDist = cardSize / (0.33 * 2 * tan35 * aspect);
    const dist = THREE.MathUtils.clamp(rawDist, 5, 16);

    const visibleWidthAtDist = 2 * tan35 * dist * aspect;
    const lookAtX = cardWorldPos.x + visibleWidthAtDist / 3;
    const lookAtY = cardWorldPos.y;

    const targetCamPos = new THREE.Vector3(lookAtX, lookAtY, cardWorldPos.z + dist);
    const lookAt = new THREE.Vector3(lookAtX, lookAtY, 0);

    const z = zoomState.current;
    z.targetCamPos = targetCamPos;
    z.lookAt = lookAt;
    z.originalLookAt = new THREE.Vector3(z.panSnapshot.x, z.panSnapshot.y, 0);
    z.originalCamPos = new THREE.Vector3(
      z.panSnapshot.x,
      z.panSnapshot.y,
      z.initialCamZ
    );
    z.initialDist = z.originalCamPos.distanceTo(targetCamPos);
    z.progress = 0;
    z.loggedTrigger = false;
    z.active = true;
    z.collapsing = false;

    setDiscSlideActive(false);
    setExpandedAlbumId(albumId);
    onAlbumExpand?.(albumId, albumName, albumCoverUrl, tracks);
  };

  const collapse = () => {
    const z = zoomState.current;
    z.active = false;
    z.collapsing = true;
    setDiscSlideActive(false);
    setExpandedAlbumId(null);
    onCollapse?.();
  };

  return (
    <>
      {!albumsReady && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#1DB954",
                  animation: `vinyl-dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <p
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              marginTop: 16,
              fontFamily: "Inter, system-ui, sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            Loading albums
          </p>
          <style>{`
            @keyframes vinyl-dot-pulse {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      <Canvas
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          background: "transparent",
          pointerEvents: "auto",
        }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ fov: 70, position: [0, 0, 22], near: 0.1, far: 200 }}
        onCreated={({ camera }) => {
          (window as any).__camera = camera;
          zoomState.current.originalCamPos = camera.position.clone();
          zoomState.current.initialCamZ = camera.position.z;
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[0, 5, 15]} intensity={0.6} color="#fff8f0" />
        <pointLight position={[6, 6, 8]} intensity={1.4} color="#ffffff" />
        <pointLight position={[-6, -4, 3]} intensity={0.5} color="#3a3aff" />
        <pointLight position={[0, 0, -10]} intensity={0.2} color="#ff8844" />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          enableZoom
          enablePan
          enableRotate={false}
          minAzimuthAngle={0}
          maxAzimuthAngle={0}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
          screenSpacePanning={true}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
          panSpeed={0.8}
          zoomSpeed={0.8}
          minDistance={3}
          maxDistance={50}
          makeDefault
        />

        <ZoomController
          zoomState={zoomState}
          controlsRef={controlsRef}
          pressedDirection={pressedDirection}
          onDiscSlide={() => {
            setDiscSlideActive(true);
            onDiscSlide?.();
          }}
          onZoomComplete={() => {}}
        />
        <OriginCapture zoomState={zoomState} controlsRef={controlsRef} />

        {/* Skeleton placeholders — fade out once textures have loaded */}
        {showSkeleton && (
          <SkeletonWall phase={albumsReady ? "exit" : "loading"} layout={skeletonLayout} />
        )}

        {/* Album cards inside Suspense so useTexture suspensions are caught.
            AlbumsReadySignal fires once every texture has resolved. */}
        <Suspense fallback={null}>
          {albumGroups.map((group, i) => {
            const { x, y, scale } = positions[i] || { x: 0, y: 0, scale: 1 };
            const isExpanded = expandedAlbumId === group.albumId;
            const isBlurred = expandedAlbumId !== null && !isExpanded;
            return (
              <group key={group.albumId} position={[x, y, 0.1]}>
                <MemoizedAlbumCover
                  albumCoverUrl={group.albumCoverUrl}
                  position={[0, 0, 0]}
                  trackCount={group.trackCount}
                  index={i}
                  scale={scale}
                  isExpanded={isExpanded}
                  discSlideActive={isExpanded && discSlideActive}
                  isBlurred={isBlurred}
                  albumName={group.albumName}
                  onExpand={() =>
                    handleExpand(
                      group.albumId,
                      group.albumName,
                      group.albumCoverUrl,
                      group.tracks,
                      x,
                      y,
                      group.trackCount
                    )
                  }
                />
              </group>
            );
          })}
          {albumGroups.length > 0 && (
            <AlbumsReadySignal onReady={handleAlbumsReady} />
          )}
        </Suspense>

        {/* Background click collapses — only mounted when an album is expanded
            so the invisible plane never intercepts pointer-down during free panning */}
        {expandedAlbumId && (
          <mesh position={[0, 0, -0.5]} onPointerDown={() => collapse()}>
            <planeGeometry args={[WALL_WIDTH, WALL_HEIGHT]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}

        {/* Wall + record player — texture fallback while loading */}
        <Suspense
          fallback={
            <mesh position={[0, 0, -3]}>
              <planeGeometry args={[120, 70]} />
              <meshStandardMaterial
                color="#eeebe7"
                roughness={0.85}
                metalness={0.0}
              />
            </mesh>
          }
        >
          <WallBackground roomType={roomType} />
          {roomType === "study" && <RecordPlayer />}
        </Suspense>
      </Canvas>

      {/* Back Arrow Overlay */}
      {expandedAlbumId && (
        <div
          onClick={collapse}
          style={{
            position: "absolute",
            top: "40px",
            left: "40px",
            width: "48px",
            height: "48px",
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(12px)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 50,
            border: "1px solid rgba(255,255,255,0.1)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.4)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="Go Back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
      )}
    </>
  );
}
