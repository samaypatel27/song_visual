"use client";

import { useEffect, useState, useRef, memo } from "react";
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
  initialDist: number;    // distance to target at zoom start
  progress: number;       // 0 → 1
  loggedTrigger: boolean; // avoid spamming console
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
      // Collapse: lerp back to original
      camera.position.lerp(z.originalCamPos, 0.055);
      if (ctrl) ctrl.target.lerp(z.originalLookAt, 0.055);

      const remaining = camera.position.distanceTo(z.originalCamPos);
      if (remaining < 0.08) {
        z.collapsing = false;
        onZoomComplete();
      }

      if (ctrl) ctrl.update();

    } else {
      // D-pad panning (when not zoomed)
      if (!ctrl) return;
      const dir = pressedDirection.current;
      const speed = 0.25;
      if (dir === "up")    ctrl.target.y += speed;
      if (dir === "down")  ctrl.target.y -= speed;
      if (dir === "left")  ctrl.target.x -= speed;
      if (dir === "right") ctrl.target.x += speed;
      if (dir === "reset") ctrl.target.lerp(ORIGIN, 0.12);

      ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -12, 12);
      ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -8, 8);
      if (dir) ctrl.update();
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENE
// ─────────────────────────────────────────────────────────────────────────────
const MemoizedAlbumCover = memo(AlbumCover);

export function VinylScene({ playlistId, pressedDirection, onAlbumExpand, onDiscSlide, onCollapse }: VinylSceneProps) {
  const [albumGroups, setAlbumGroups] = useState<AlbumGroup[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
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
    initialDist: 0,
    progress: 0,
    loggedTrigger: false,
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playlistId) return;
    const controller = new AbortController();
    let isMounted = true;

    const loadData = async () => {
      try {
        let offset = 0;
        let limit = 50;
        let total = 1;
        setIsFetchingMore(true);

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
            setAlbumGroups(cumulativeGroups);
            setPositions(cumulativePositions);
          }

          offset += limit;
        }
      } catch (err: any) {
        if (err.name !== "AbortError") console.error("[VinylScene] fetch error:", err);
      } finally {
        if (isMounted) setIsFetchingMore(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [playlistId]);

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
      <Canvas
        style={{ position: "fixed", inset: 0, zIndex: 1, background: "transparent", pointerEvents: "auto" }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ fov: 70, position: [0, 0, 22], near: 0.1, far: 200 }}
        onCreated={({ camera }) => {
          // Expose camera so handleExpand can read its position at click time
          (window as any).__camera = camera;
          zoomState.current.originalCamPos = camera.position.clone();
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

        {/* Album cards */}
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

        {/* Background click collapses */}
        <mesh
          position={[0, 0, -0.5]}
          visible={!!expandedAlbumId}
          onPointerDown={() => collapse()}
        >
          <planeGeometry args={[WALL_WIDTH, WALL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* WALL */}
        <mesh position={[0, 0, -3]}>
          <planeGeometry args={[120, 70]} />
          <meshStandardMaterial color="#eeebe7" roughness={0.85} metalness={0.0} />
        </mesh>
      </Canvas>

      {isFetchingMore && (
        <div style={{
          position: "absolute", bottom: "20px", right: "20px",
          color: "white", background: "rgba(0,0,0,0.6)",
          padding: "8px 16px", borderRadius: "8px",
          fontFamily: "Inter, sans-serif", fontSize: "14px",
          pointerEvents: "none", zIndex: 10,
        }}>
          Loading remaining albums...
        </div>
      )}
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
