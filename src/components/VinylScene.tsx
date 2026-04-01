"use client";

import { useEffect, useState, useRef, memo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { VinylRecord } from "./VinylRecord";
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
  tracks: PlaylistTrackEntry[];
}

export interface VinylSceneProps {
  playlistId: string;
  pressedDirection: React.MutableRefObject<
    "up" | "down" | "left" | "right" | "reset" | null
  >;
  onAlbumExpand?: (albumId: string, albumName: string, albumCoverUrl: string, tracks: PlaylistTrackEntry[]) => void;
  onDiscSlide?: () => void;
  onCollapse?: () => void;
}

const groupByAlbum = (tracks: Track[]): AlbumGroup[] => {
  const map = new Map<string, AlbumGroup>();
  tracks.forEach((track) => {
    if (map.has(track.albumId)) {
      const g = map.get(track.albumId)!;
      g.trackCount += 1;
      g.tracks.push({ trackNumber: track.trackNumber, trackName: track.trackName, durationMs: track.durationMs });
    } else {
      map.set(track.albumId, {
        albumId: track.albumId,
        albumName: track.albumName,
        albumCoverUrl: track.albumCoverUrl,
        trackCount: 1,
        tracks: [{ trackNumber: track.trackNumber, trackName: track.trackName, durationMs: track.durationMs }],
      });
    }
  });
  // Sort largest albums first — they'll get center placement
  return Array.from(map.values()).sort((a, b) => b.trackCount - a.trackCount);
};

export const getDiscRadius = (trackCount: number): number =>
  Math.min(1.8 + (trackCount - 1) * 0.45, 4.2);

/**
 * Place discs from largest → smallest.
 * Large discs (early indices) get a tight center zone; smaller discs expand
 * outward into the full scene. Overlap is prevented with radius-aware minimum
 * separation. Deterministic seeds → stable layout across renders.
 *
 * Scene visible bounds at fov=70, camera z=22: approx ±18x, ±10y.
 * 20% edge margin → usable: ±13x, ±7.2y.
 */

// Card size helper (same as AlbumCover)

const WALL_WIDTH = 120;
const WALL_HEIGHT = 70;
const getCardSize = (trackCount: number) => Math.min(1.8 + (trackCount - 1) * 0.45, 4.2) * 2;

const WALL_ASPECT = WALL_WIDTH / WALL_HEIGHT;
const generatePositions = (groups: AlbumGroup[]) => {
  const positions: { x: number, y: number, angle: number, scale: number, size: number }[] = [];
  const wallClamp = (x: number, y: number) => [
    Math.max(-WALL_WIDTH / 2 + 2, Math.min(WALL_WIDTH / 2 - 2, x)),
    Math.max(-WALL_HEIGHT / 2 + 2, Math.min(WALL_HEIGHT / 2 - 2, y)),
  ];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    // Deterministic random properties based on albumId
    let h = 0;
    for (let j = 0; j < group.albumId.length; j++) h = Math.imul(31, h) + group.albumId.charCodeAt(j) | 0;
    const r1 = (((Math.imul(h ^ 1, 2654435761) ^ (h >>> 16)) >>> 0) / 4294967296);
    const r2 = (((Math.imul(h ^ 2, 2654435761) ^ (h >>> 16)) >>> 0) / 4294967296);

    const scale = 1.1 + (r1 - 0.5) * 0.12;
    const size = getCardSize(group.trackCount) * scale;

    let collision = true;
    let placedX = 0, placedY = 0;

    let r = Math.max(0, Math.floor(Math.sqrt((i * 22) / (WALL_ASPECT * Math.PI))) - 1);
    const dr = 0.5; // Small outward step
    let angleOffset = r2 * Math.PI * 2; // Randomize starting angle

    while (collision && r < 100) {
      const perimeter = r === 0 ? 1 : 4 * r * (WALL_ASPECT + 1);
      const numSamples = r === 0 ? 1 : Math.ceil(perimeter * 0.8);

      let foundSpot = false;

      for (let s = 0; s < numSamples; s++) {
        const theta = angleOffset + (s / numSamples) * Math.PI * 2;

        let u = Math.cos(theta);
        let v = Math.sin(theta);
        const max = Math.max(Math.abs(u), Math.abs(v));
        u /= max; // maps to a square profile [-1, 1]
        v /= max;

        let x = r * WALL_ASPECT * u;
        let y = r * v;

        let [clampedX, clampedY] = wallClamp(x, y);

        let tempCollision = false;
        const margin = 0.8; // extra space between albums

        for (const p of positions) {
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

    // Fallback if we exceeded bounds (should be rare)
    if (collision) {
      placedX = (r1 - 0.5) * WALL_WIDTH;
      placedY = (r2 - 0.5) * WALL_HEIGHT;
    }

    positions.push({ x: placedX, y: placedY, angle: 0, scale, size });
  }
  return positions;
};

interface ZoomState {
  active: boolean;
  collapsing: boolean;
  targetCamPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  originalCamPos: THREE.Vector3;
  originalLookAt: THREE.Vector3;
  initialDist: number;
  progress: number;
  loggedTrigger: boolean;
}

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

  useFrame(() => {
    const ctrl = controlsRef.current;
    const z = zoomState.current;

    if (z.active) {
      camera.position.lerp(z.targetCamPos, 0.055);
      if (ctrl) ctrl.target.lerp(z.lookAt, 0.055);

      const remaining = camera.position.distanceTo(z.targetCamPos);
      z.progress = z.initialDist > 0 ? 1 - (remaining / z.initialDist) : 1;

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
        z.collapsing = false;
        onZoomComplete();
      }
      if (ctrl) ctrl.update();
    } else {
      if (!ctrl) return;
      const dir = pressedDirection.current;
      const speed = 0.25;
      if (dir === "up") ctrl.target.y += speed;
      if (dir === "down") ctrl.target.y -= speed;
      if (dir === "left") ctrl.target.x -= speed;
      if (dir === "right") ctrl.target.x += speed;
      if (dir === "reset") ctrl.target.lerp(ORIGIN, 0.12);

      ctrl.target.x = THREE.MathUtils.clamp(ctrl.target.x, -12, 12);
      ctrl.target.y = THREE.MathUtils.clamp(ctrl.target.y, -8, 8);
      if (dir) ctrl.update();
    }
  });

  return null;
}

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

function WallBackground() {
  const tex = useTexture("/Wall_Background.png");
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

// Record player image overlaid on the wall, sitting on the table (bottom-right)
function RecordPlayer() {
  const tex = useTexture("/record_player.png");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  // Width ~24 units, height ~19 units (preserving ~1.27:1 aspect of the source PNG)
  // Positioned bottom-right on the table: x=35 (right side), y=-23 (table surface)
  // z=-2.85 puts it just in front of the wall (wall is at z=-3)
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

// VinylScene
const MemoizedAlbumCover = memo(AlbumCover);

export function VinylScene({ playlistId, pressedDirection, onAlbumExpand, onDiscSlide, onCollapse }: VinylSceneProps) {
  const [albumGroups, setAlbumGroups] = useState<AlbumGroup[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [discSlideActive, setDiscSlideActive] = useState(false);

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

        const globalChunkMap = new Map<string, AlbumGroup>();

        while (offset < total && isMounted) {
          const res = await fetch(`/api/spotify/playlist-tracks/${playlistId}?limit=${limit}&offset=${offset}`, { signal: controller.signal });
          if (!res.ok) throw new Error(String(res.status));

          const data = await res.json();
          total = data.total || 0;
          limit = data.limit || 50;

          if (!data.tracks) break;

          data.tracks.forEach((t: Track) => {
            const trackEntry = { trackNumber: t.trackNumber, trackName: t.trackName, durationMs: t.durationMs };
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
                tracks: [trackEntry]
              });
            }
          });

          // Sort entire known list of albums to maintain aesthetic sizing prioritization 
          const sortedAllGroups = Array.from(globalChunkMap.values()).sort((a, b) => b.trackCount - a.trackCount);

          if (sortedAllGroups.length > 0) {
            const newPositions = generatePositions(sortedAllGroups);

            // Append securely to trigger React reconciler
            setAlbumGroups(sortedAllGroups);
            setPositions(newPositions);
          }

          offset += limit;
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("[VinylScene] fetch error:", err);
        }
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

  const handleExpand = (
    albumId: string,
    albumName: string,
    albumCoverUrl: string,
    tracks: PlaylistTrackEntry[],
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
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[0, 5, 15]} intensity={0.6} color="#fff8f0" />
        {/* wall fill */}
        <pointLight position={[6, 6, 8]} intensity={1.4} color="#ffffff" />
        <pointLight position={[-6, -4, 3]} intensity={0.5} color="#3a3aff" />
        <pointLight position={[0, 0, -10]} intensity={0.2} color="#ff8844" />

        {/*
        OrbitControls — restores full mouse/touchpad navigation.
        enableDamping gives smooth deceleration after gestures.
        The d-pad adjusts controls.target (via CameraController) rather than
        camera.position, so both input methods coexist without conflict.
      */}
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

        {/* Zoom controller and original lookat capture */}
        <ZoomController
          zoomState={zoomState}
          controlsRef={controlsRef}
          pressedDirection={pressedDirection}
          onDiscSlide={() => {
            setDiscSlideActive(true);
            onDiscSlide?.();
          }}
          onZoomComplete={() => { }}
        />
        <OriginCapture zoomState={zoomState} controlsRef={controlsRef} />

        {/* One disc per unique album, sorted largest → smallest (centre → outskirts) */}
        {albumGroups.map((group, i) => {
          const { x, y, scale } = positions[i] || { x: 0, y: 0, scale: 1 };
          const isExpanded = expandedAlbumId === group.albumId;
          const isBlurred = expandedAlbumId !== null && expandedAlbumId !== group.albumId;
          return (
            <group
              key={group.albumId}
              position={[x, y, 0.1]}
              rotation={[0, 0, 0]}
            >
              <AlbumCover
                albumCoverUrl={group.albumCoverUrl}
                position={[0, 0, 0]}
                trackCount={group.trackCount}
                index={i}
                scale={scale}
                isExpanded={isExpanded}
                discSlideActive={isExpanded && discSlideActive}
                isBlurred={isBlurred}
                albumName={group.albumName}
                onExpand={() => handleExpand(group.albumId, group.albumName, group.albumCoverUrl, group.tracks, x, y, group.trackCount)}
              />
            </group>
          );
        })}

        {/* Collapse on background click or Escape */}
        <mesh
          position={[0, 0, -0.5]}
          visible={!!expandedAlbumId}
          onPointerDown={collapse}
        >
          <planeGeometry args={[WALL_WIDTH, WALL_HEIGHT]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Collapse on Escape key */}
        {expandedAlbumId && (
          <primitive
            object={{}}
            attach={null}
            onUpdate={() => {
              const handler = (e: KeyboardEvent) => {
                if (e.key === "Escape") collapse();
              };
              window.addEventListener("keydown", handler);
              return () => window.removeEventListener("keydown", handler);
            }}
          />
        )}

        {/* WALL — customize color/texture/material here  */}
        <Suspense fallback={
          <mesh position={[0, 0, -3]}>
            <planeGeometry args={[120, 70]} />
            <meshStandardMaterial color="#eeebe7" roughness={0.85} metalness={0.0} />
          </mesh>
        }>
          <WallBackground />
          <RecordPlayer />
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
            transition: "all 0.2s ease"
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </div>
      )}

      {isFetchingMore && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          color: "white",
          background: "rgba(0,0,0,0.6)",
          padding: "8px 16px",
          borderRadius: "8px",
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          pointerEvents: "none",
          zIndex: 10
        }}>
          Loading remaining albums...
        </div>
      )}
    </>
  );
}
