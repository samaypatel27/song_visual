"use client";

import { useEffect, useState, useRef, memo, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { AlbumCover } from "./AlbumCover";

// TYPES
interface Track {
  trackId: string;
  trackName: string;
  albumId: string;
  albumName: string;
  albumCoverUrl: string;
  trackNumber: number;
  durationMs: number;
}

// PlaylistTrackEntry — the shape passed to the panel (no album metadata needed)
export interface PlaylistTrackEntry {
  trackNumber: number;
  trackName: string;
  durationMs: number;
}

export interface AlbumGroup {
  albumId: string;
  albumName: string;
  albumCoverUrl: string;
  trackCount: number;
}

export interface VinylSceneProps {
  playlistId: string;
  pressedDirection: React.MutableRefObject<
    "up" | "down" | "left" | "right" | "reset" | null
  >;
  onAlbumExpand?: (albumId: string, albumName: string, albumCoverUrl: string, playlistTracks: PlaylistTrackEntry[]) => void;
  onDiscSlide?: () => void;
  onCollapse?: () => void;
}

const groupByAlbum = (tracks: Track[]): AlbumGroup[] => {
  const map = new Map<string, AlbumGroup>();
  tracks.forEach((track) => {
    if (map.has(track.albumId)) {
      map.get(track.albumId)!.trackCount += 1;
    } else {
      map.set(track.albumId, {
        albumId: track.albumId,
        albumName: track.albumName,
        albumCoverUrl: track.albumCoverUrl,
        trackCount: 1,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.trackCount - a.trackCount);
};

export const getDiscRadius = (trackCount: number): number =>
  Math.min(1.8 + (trackCount - 1) * 0.45, 4.2);

const WALL_WIDTH = 120;
const WALL_HEIGHT = 70;
const getCardSize = (trackCount: number) => Math.min(1.8 + (trackCount - 1) * 0.45, 4.2) * 2;

const WALL_ASPECT = WALL_WIDTH / WALL_HEIGHT;
const generatePositions = (newGroups: AlbumGroup[], existingPositions: any[]) => {
  const positions: { x: number, y: number, angle: number, scale: number, size: number }[] = [];
  const wallClamp = (x: number, y: number) => [
    Math.max(-WALL_WIDTH / 2 + 2, Math.min(WALL_WIDTH / 2 - 2, x)),
    Math.max(-WALL_HEIGHT / 2 + 2, Math.min(WALL_HEIGHT / 2 - 2, y)),
  ];

  for (let i = 0; i < newGroups.length; i++) {
    const scale = 1.1 + (Math.random() - 0.5) * 0.12;
    const size = getCardSize(newGroups[i].trackCount) * scale;

    let collision = true;
    let placedX = 0, placedY = 0;

    const totalCount = existingPositions.length + i;
    let r = Math.max(0, Math.floor(Math.sqrt((totalCount * 22) / (WALL_ASPECT * Math.PI))) - 1);
    const dr = 0.5;
    let angleOffset = Math.random() * Math.PI * 2;

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

        let x = r * WALL_ASPECT * u;
        let y = r * v;

        let [clampedX, clampedY] = wallClamp(x, y);

        let tempCollision = false;
        const margin = 0.8;

        for (const p of [...existingPositions, ...positions]) {
          const dx = Math.abs(clampedX - p.x);
          const dy = Math.abs(clampedY - p.y);
          const minDistanceX = (size + p.size) / 2 + margin;
          const minDistanceY = (size + p.size) / 2 + margin;

          if (dx < minDistanceX && dy < minDistanceY) {
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

      if (!foundSpot) {
        r += dr;
      }
    }

    if (collision) {
      placedX = (Math.random() - 0.5) * WALL_WIDTH;
      placedY = (Math.random() - 0.5) * WALL_HEIGHT;
    }

    positions.push({ x: placedX, y: placedY, angle: 0, scale, size });
  }
  return positions;
};

// ─────────────────────────────────────────────────────────────────────────────
// ZOOM STATE — shared between ZoomController and click handlers
// Using a plain object ref (not React state) so it never triggers re-renders
// inside the useFrame loop.
// ─────────────────────────────────────────────────────────────────────────────
interface ZoomState {
  active: boolean;
  collapsing: boolean;
  targetCamPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  originalCamPos: THREE.Vector3;
  originalLookAt: THREE.Vector3;
  panSnapshot: THREE.Vector3;  // live-updated each idle frame — used for collapse target
  initialCamZ: number;         // z distance at scene creation — used for collapse zoom-out
  initialDist: number;         // distance to target at zoom start
  progress: number;            // 0 → 1
  loggedTrigger: boolean;      // avoid spamming console
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOOM CONTROLLER
// Owns the per-frame camera dolly, tracks progress, triggers disc slide.
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
  pressedDirection: React.MutableRefObject<"up" | "down" | "left" | "right" | "reset" | null>;
  onDiscSlide: () => void;
  onZoomComplete: () => void;
}) {
  const { camera } = useThree();
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  const frameCountRef = useRef(0);

  useFrame(() => {
    const ctrl = controlsRef.current;
    const z = zoomState.current;

    if (z.active) {
      // Camera dolly toward target
      camera.position.lerp(z.targetCamPos, 0.055);
      if (ctrl) ctrl.target.lerp(z.lookAt, 0.055);

      // Track progress (0 = start, 1 = arrived)
      const remaining = camera.position.distanceTo(z.targetCamPos);
      z.progress = z.initialDist > 0 ? 1 - (remaining / z.initialDist) : 1;

      // Log progress every 60 frames
      frameCountRef.current++;
      if (frameCountRef.current % 60 === 0) {
        console.log(
          `[VinylScene] zoom progress: ${(z.progress * 100).toFixed(0)}%`
        );
      }

      // Trigger disc slide at 92%
      if (z.progress >= 0.92 && !z.loggedTrigger) {
        z.loggedTrigger = true;
        console.log(
          `[VinylScene] zoom progress: ${(z.progress * 100).toFixed(0)}% | disc slide triggered at 92%`
        );
        onDiscSlide();
      }

      if (ctrl) ctrl.update();

    } else if (z.collapsing) {
      // Collapse: lerp back to where the user was panning, at full zoom-out distance
      camera.position.lerp(z.originalCamPos, 0.055);
      if (ctrl) ctrl.target.lerp(z.originalLookAt, 0.055);

      const remaining = camera.position.distanceTo(z.originalCamPos);
      if (remaining < 0.08) {
        // Snap exactly so OrbitControls doesn't desync on next drag
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

      // D-pad panning
      if (!ctrl) return;
      const dir = pressedDirection.current;
      if (dir) {
        const speed = 0.25;
        if (dir === "up")    { ctrl.target.y += speed; ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -32, 32); }
        if (dir === "down")  { ctrl.target.y -= speed; ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -32, 32); }
        if (dir === "left")  { ctrl.target.x -= speed; ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -55, 55); }
        if (dir === "right") { ctrl.target.x += speed; ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -55, 55); }
        if (dir === "reset") ctrl.target.lerp(ORIGIN, 0.12);
        ctrl.update();
      }
    }
  });

  return null;
}

// Renders nothing, but its useEffect only fires once all sibling Suspense
// children (album textures) have resolved — that's when we signal ready.
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
// Generate skeleton positions using the same layout algorithm as real albums,
// with representative track counts so sizes/spacing feel realistic.
const SKELETON_GROUPS: AlbumGroup[] = [
  3, 8, 5, 12, 2, 7, 4, 10, 3, 6, 8, 2, 5, 4, 7,
].map((trackCount, i) => ({
  albumId: `sk-${i}`, albumName: "", albumCoverUrl: "", trackCount,
}));
const SKELETON_LAYOUT = generatePositions(SKELETON_GROUPS, []);

const SkeletonCover = memo(({ x, y, size, phaseOffset }: {
  x: number; y: number; size: number; phaseOffset: number;
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
      <meshStandardMaterial ref={matRef} roughness={0.9} metalness={0.05} transparent />
    </mesh>
  );
});
SkeletonCover.displayName = "SkeletonCover";

// phase 'loading' — API loading or textures loading: continuous pulse 0.2 ↔ 1.0
// phase 'exit'    — textures ready: fade out quickly to 0
function SkeletonWall({ phase }: { phase: "loading" | "exit" }) {
  const groupRef = useRef<THREE.Group>(null);
  const opRef = useRef(0);

  useFrame(({ clock }) => {
    if (phase === "exit") {
      opRef.current = THREE.MathUtils.lerp(opRef.current, 0, 0.05);
    } else {
      // Pulse continuously between ~0.2 and 1.0
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
      {SKELETON_LAYOUT.map((pos, i) => (
        <SkeletonCover key={i} x={pos.x} y={pos.y} size={pos.size} phaseOffset={i * 0.8} />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────────────────────────────────────
const MemoizedAlbumCover = memo(AlbumCover);

export function VinylScene({ playlistId, pressedDirection, onAlbumExpand, onDiscSlide, onCollapse }: VinylSceneProps) {
  const [albumGroups, setAlbumGroups] = useState<AlbumGroup[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

  const [showSkeleton, setShowSkeleton] = useState(true);
  const [albumsReady, setAlbumsReady] = useState(false);
  const handleAlbumsReady = useCallback(() => setAlbumsReady(true), []);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Expanded state
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [discSlideActive, setDiscSlideActive] = useState(false);

  // Cross-chunk accumulator: all playlist track entries per album (survives chunk splits)
  // Keyed by albumId → deduped by trackId to avoid double-counting
  const playlistTracksByAlbumRef = useRef(new Map<string, PlaylistTrackEntry[]>());

  // Zoom state (ref — mutations don't cause re-renders)
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

  // ── Fetch ──────────────────────────────────────────────────────────────────
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

        let cumulativeGroups: AlbumGroup[] = [];
        let cumulativePositions: any[] = [];

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

          const existingIds = new Set(cumulativeGroups.map((g) => g.albumId));
          const chunkMap = new Map<string, AlbumGroup>();

          data.tracks.forEach((t: Track) => {
            // Accumulate full track entries per album across ALL chunks (dedup by name)
            const entries = playlistTracksByAlbumRef.current.get(t.albumId);
            const entry: PlaylistTrackEntry = { trackNumber: t.trackNumber, trackName: t.trackName, durationMs: t.durationMs };
            if (entries) {
              if (!entries.some(e => e.trackName === t.trackName)) entries.push(entry);
            } else {
              playlistTracksByAlbumRef.current.set(t.albumId, [entry]);
            }

            if (existingIds.has(t.albumId)) return;
            if (chunkMap.has(t.albumId)) {
              chunkMap.get(t.albumId)!.trackCount++;
            } else {
              chunkMap.set(t.albumId, {
                albumId: t.albumId,
                albumName: t.albumName,
                albumCoverUrl: t.albumCoverUrl,
                trackCount: 1,
              });
            }
          });

          const newGroups = Array.from(chunkMap.values()).sort(
            (a, b) => b.trackCount - a.trackCount
          );

          if (newGroups.length > 0) {
            const newPositions = generatePositions(newGroups, cumulativePositions);
            cumulativeGroups = [...cumulativeGroups, ...newGroups];
            cumulativePositions = [...cumulativePositions, ...newPositions];
          }

          offset += limit;
        }

        // Set state once after all pages are fetched so albums appear all at once
        if (isMounted && cumulativeGroups.length > 0) {
          setAlbumGroups(cumulativeGroups);
          setPositions(cumulativePositions);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") console.error("[VinylScene] fetch error:", err);
      } finally {
      }
    };

    loadData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [playlistId]);

  // Unmount skeleton after its fade-out animation completes (~900ms)
  useEffect(() => {
    if (albumsReady) {
      const t = setTimeout(() => setShowSkeleton(false), 900);
      return () => clearTimeout(t);
    }
  }, [albumsReady]);

  // ── Click handler — compute camera zoom target ─────────────────────────────
  const handleExpand = (
    albumId: string,
    albumName: string,
    albumCoverUrl: string,
    cardWorldX: number,
    cardWorldY: number,
    trackCount: number
  ) => {
    const isAlreadyExpanded = expandedAlbumId === albumId;
    if (isAlreadyExpanded) {
      collapse();
      return;
    }

    const cardSize = getCardSize(trackCount);
    const cardWorldPos = new THREE.Vector3(cardWorldX, cardWorldY, 0.1);

    // Camera zoom math:
    // We want the sleeve to occupy ~33% of screen width.
    // visibleWidth = 2 * tan(fov/2) * dist * aspect
    // cardSize / visibleWidth = 0.33  →  dist = cardSize / (0.33 * 2 * tan35° * aspect)
    const fovRad = 70 * (Math.PI / 180);
    const aspect = window.innerWidth / window.innerHeight;
    const tan35 = Math.tan(fovRad / 2);
    const rawDist = cardSize / (0.33 * 2 * tan35 * aspect);
    const dist = THREE.MathUtils.clamp(rawDist, 5, 16);

    // LookAt shifted right so card sits in LEFT THIRD:
    // visibleWidth at dist = 2*tan35*dist*aspect
    // card center → lookAt.x offset = visibleWidth / 3
    const visibleWidthAtDist = 2 * tan35 * dist * aspect;
    const lookAtX = cardWorldPos.x + visibleWidthAtDist / 3;
    const lookAtY = cardWorldPos.y;

    const targetCamPos = new THREE.Vector3(lookAtX, lookAtY, cardWorldPos.z + dist);
    const lookAt = new THREE.Vector3(lookAtX, lookAtY, 0);

    const z = zoomState.current;
    z.targetCamPos = targetCamPos;
    z.lookAt = lookAt;
    // Use live-tracked pan position for collapse target, always zoom back out to initialCamZ
    z.originalLookAt = new THREE.Vector3(z.panSnapshot.x, z.panSnapshot.y, 0);
    z.originalCamPos = new THREE.Vector3(z.panSnapshot.x, z.panSnapshot.y, z.initialCamZ);
    z.initialDist = z.originalCamPos.distanceTo(targetCamPos);
    z.progress = 0;
    z.loggedTrigger = false;
    z.active = true;
    z.collapsing = false;

    setDiscSlideActive(false);
    setExpandedAlbumId(albumId);
    const playlistTracks = playlistTracksByAlbumRef.current.get(albumId) ?? [];
    console.log(`[VinylScene] playlist tracks from this album: ${playlistTracks.length}`);
    onAlbumExpand?.(albumId, albumName, albumCoverUrl, playlistTracks);

    console.log(
      `[VinylScene] zoom target — cameraPos: [${targetCamPos.x.toFixed(2)},${targetCamPos.y.toFixed(2)},${targetCamPos.z.toFixed(2)}] | lookAt: [${lookAt.x.toFixed(2)},${lookAt.y.toFixed(2)},0] | cardWorldPos unchanged: [${cardWorldPos.x.toFixed(2)},${cardWorldPos.y.toFixed(2)},0.1]`
    );
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
        <div style={{
          position: "fixed", inset: 0, zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%", background: "#1DB954",
                animation: `vinyl-dot-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <p style={{
            color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 16,
            fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "0.08em",
          }}>Loading albums</p>
          <style>{`
            @keyframes vinyl-dot-pulse {
              0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
              40% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}
      <Canvas
        style={{ position: "fixed", inset: 0, zIndex: 1, background: "transparent", pointerEvents: "auto" }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ fov: 70, position: [0, 0, 22], near: 0.1, far: 200 }}
        onCreated={({ camera }) => {
          // Expose camera so handleExpand can read its position at click time
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

        {/* Camera dolly + d-pad controller */}
        <ZoomController
          zoomState={zoomState}
          controlsRef={controlsRef}
          pressedDirection={pressedDirection}
          onDiscSlide={() => { setDiscSlideActive(true); onDiscSlide?.(); }}
          onZoomComplete={() => {}}
        />
        {/* Capture original lookAt after controls mount */}
        <OriginCapture zoomState={zoomState} controlsRef={controlsRef} />

        {/* Skeleton placeholders — fade out once album textures have all loaded */}
        {showSkeleton && (
          <SkeletonWall phase={albumsReady ? "exit" : "loading"} />
        )}

        {/* Album cards — wrapped in Suspense so useTexture suspensions are caught.
            AlbumsReadySignal only mounts (and fires) once every texture has resolved. */}
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
                  onExpand={() => handleExpand(group.albumId, group.albumName, group.albumCoverUrl, x, y, group.trackCount)}
                />
              </group>
            );
          })}
          {albumGroups.length > 0 && <AlbumsReadySignal onReady={handleAlbumsReady} />}
        </Suspense>

        {/* Background click collapses — only mounted when an album is expanded
            so the invisible plane never intercepts pointer-down during free panning */}
        {expandedAlbumId && (
          <mesh position={[0, 0, -0.5]} onPointerDown={() => collapse()}>
            <planeGeometry args={[WALL_WIDTH, WALL_HEIGHT]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        )}

        {/* WALL */}
        <mesh position={[0, 0, -3]}>
          <planeGeometry args={[120, 70]} />
          <meshStandardMaterial color="#eeebe7" roughness={0.85} metalness={0.0} />
        </mesh>
      </Canvas>

    </>
  );
}

// ── Captures original camera lookAt once controls are mounted ──────────────
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
