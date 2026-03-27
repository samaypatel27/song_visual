"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// Sizing logic: use the same as getDiscRadius
const getCardSize = (trackCount: number) =>
  Math.min(1.8 + (trackCount - 1) * 0.45, 4.2) * 2; // diameter to square side

// Animation frequencies (incommensurable)
const JIGGLE_FREQ = 1 / 3; // ~3s
const MICRO_FREQ = 1 / 0.8; // ~0.8s
const FLOAT_FREQ = 1 / 4; // ~4s
const GOLDEN = 1.618;

// Module-Level Mathematics (Singletons to avert GC spikes inside useFrame)
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const _sphere = new THREE.Sphere();
const _worldPos = new THREE.Vector3(); // for world-space frustum culling

export interface AlbumCoverProps {
  albumCoverUrl: string;
  position: [number, number, number];
  trackCount: number;
  index: number;
  scale?: number;
  isExpanded?: boolean;
  discSlideActive?: boolean; // true once camera reaches 92% zoom
  isBlurred?: boolean;
  albumName?: string;
  onExpand?: () => void;
}

export function AlbumCover({
  albumCoverUrl,
  position,
  trackCount,
  index,
  scale = 1,
  isExpanded = false,
  discSlideActive = false,
  isBlurred = false,
  onExpand,
}: AlbumCoverProps) {
  const groupRef = useRef<THREE.Group>(null);
  const discGroupRef = useRef<THREE.Group>(null);
  const recordTransformRef = useRef<THREE.Group>(null);

  const cardSize = getCardSize(trackCount);
  const cardDepth = 0.22;
  const borderInset = 0.04 * cardSize;
  const shadowOffset = [0, 0, -0.02];

  // Refs for animation state (no re-renders)
  const hoveredRef = useRef(false);
  const bevelOpacityRef = useRef(0.12);
  const topBevelOpacityRef = useRef(0.18);
  const recordSlideRef = useRef(0);
  const currentScaleRef = useRef(scale);
  const visRef = useRef(1); // 1 = fully visible, 0 = hidden (not blurred)
  const discSpinRef = useRef(0);
  const discSpinSpeedRef = useRef(0);

  // Prop → ref sync: updated synchronously each render so useFrame always
  // sees the latest value without async useEffect lag.
  const isBlurredRef = useRef(false);
  const discSlideActiveRef = useRef(false);
  isBlurredRef.current = isBlurred;
  discSlideActiveRef.current = discSlideActive;

  // Material refs for rapid mutations without re-renders
  const topBevelRef = useRef<THREE.MeshStandardMaterial>(null);
  const bottomBevelRef = useRef<THREE.MeshStandardMaterial>(null);
  const leftBevelRef = useRef<THREE.MeshStandardMaterial>(null);
  const rightBevelRef = useRef<THREE.MeshStandardMaterial>(null);

  // Album art texture
  const albumTexture = useTexture(albumCoverUrl);
  albumTexture.colorSpace = THREE.SRGBColorSpace;
  albumTexture.minFilter = THREE.LinearFilter;
  albumTexture.magFilter = THREE.LinearFilter;

  // Animation
  useFrame(({ clock, camera }) => {
    if (!groupRef.current) return;

    // 0. Visibility fade — when another album is expanded this one fades out and
    //    is fully hidden via group.visible = false (no color matching, truly invisible).
    visRef.current += ((isBlurredRef.current ? 0 : 1) - visRef.current) * 0.12;
    const shouldBeVisible = visRef.current > 0.05;
    groupRef.current.visible = shouldBeVisible;
    if (!shouldBeVisible) return; // skip all further work when hidden

    // 1. Frustum culling — use WORLD position, not local (local is always (0,0,0)
    //    since AlbumCover lives inside an outer group at [x,y,0.1] in VinylScene).
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    groupRef.current.getWorldPosition(_worldPos);
    _sphere.set(_worldPos, cardSize);
    if (!_frustum.intersectsSphere(_sphere)) return;

    const isHovered = hoveredRef.current;
    const slideActive = discSlideActiveRef.current;

    // Scale target: expanded cards don't scale up on hover (camera does the zoom)
    const targetScale = (isHovered && !slideActive ? 1.1 : 1.0) * scale;

    // Disc slide target:
    //  • idle                → 0 (hidden)
    //  • hovered (no expand) → cardSize * 0.55 (partial peek)
    //  • discSlideActive     → cardSize * 0.72 (left 25% behind sleeve)
    const slideTarget = slideActive
      ? cardSize * 0.72
      : isHovered
        ? cardSize * 0.55
        : 0;

    const isTransitioning =
      Math.abs(currentScaleRef.current - targetScale) > 0.001 ||
      Math.abs(recordSlideRef.current - slideTarget) > 0.005;

    // 2. Idle state silence (no hover, no expand, not transitioning)
    if (!isHovered && !slideActive && !isTransitioning) {
      groupRef.current.scale.set(targetScale, targetScale, 1);
      groupRef.current.rotation.set(0, 0, 0);
      groupRef.current.position.set(position[0], position[1], position[2]);
      recordSlideRef.current = 0;
      if (recordTransformRef.current) recordTransformRef.current.position.x = 0;
      if (discGroupRef.current) discGroupRef.current.visible = false;

      return;
    }

    // 3. Active / hovering / expanding
    if (discGroupRef.current) {
      discGroupRef.current.visible = isHovered || slideActive || isTransitioning;
    }

    const t = clock.getElapsedTime();
    const phase = index * GOLDEN;

    // Jiggle is suppressed when expanded (camera provides the motion drama)
    const jiggleAmp = (isHovered && !slideActive) ? (Math.PI / 180) * 8 : (Math.PI / 180) * 1;
    const microAmp = (isHovered && !slideActive) ? (Math.PI / 180) * 2 : (Math.PI / 180) * 0.3;
    const jiggle = Math.sin((t + phase) * JIGGLE_FREQ * 2 * Math.PI) * jiggleAmp;
    const micro = Math.sin((t + phase * 0.7) * MICRO_FREQ * 2 * Math.PI) * microAmp;
    const floatY = Math.sin((t + phase * 0.3) * FLOAT_FREQ * 2 * Math.PI) * (slideActive ? 0.03 : 0.1);

    // Position & scale — card NEVER changes X/Y world position
    currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.18;
    groupRef.current.scale.set(currentScaleRef.current, currentScaleRef.current, 1);
    groupRef.current.rotation.set(0, 0, jiggle + micro);
    groupRef.current.position.set(position[0], position[1] + floatY, position[2]);

    // Bevel opacities
    bevelOpacityRef.current += ((isHovered ? 0.22 : 0.12) - bevelOpacityRef.current) * 0.18;
    topBevelOpacityRef.current += ((isHovered ? 0.28 : 0.18) - topBevelOpacityRef.current) * 0.18;
    if (topBevelRef.current) topBevelRef.current.opacity = topBevelOpacityRef.current;
    if (bottomBevelRef.current) bottomBevelRef.current.opacity = bevelOpacityRef.current;
    if (leftBevelRef.current) leftBevelRef.current.opacity = bevelOpacityRef.current;
    if (rightBevelRef.current) rightBevelRef.current.opacity = bevelOpacityRef.current;

    // Disc slide (seamless continuation from hover position to full expand)
    const slideLerp = slideActive ? 0.07 : 0.12;
    recordSlideRef.current += (slideTarget - recordSlideRef.current) * slideLerp;
    if (recordTransformRef.current) {
      recordTransformRef.current.position.x = recordSlideRef.current;
    }

    // Disc spin — faster during expand, decelerates once settled
    const targetSpinSpeed = slideActive ? 0.035 : (isHovered ? 0.012 : 0);
    discSpinSpeedRef.current += (targetSpinSpeed - discSpinSpeedRef.current) * 0.04;
    discSpinRef.current += discSpinSpeedRef.current;
    if (recordTransformRef.current) {
      recordTransformRef.current.rotation.z = discSpinRef.current;
    }
  });

  // Pointer events
  const onPointerOver = () => {
    if (isBlurredRef.current) return;
    hoveredRef.current = true;
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = () => {
    hoveredRef.current = false;
    document.body.style.cursor = "default";
  };
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (isBlurredRef.current) return;
    onExpand?.();
  };

  const onUpdateGeom = (geom: any) => {
    if (geom) {
      geom.computeBoundingSphere();
      geom.computeBoundingBox();
    }
  };

  // Materials
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: albumTexture,
    color: "#fff",
    roughness: 0.55,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const backMaterial = new THREE.MeshStandardMaterial({
    color: "#1c1c1c",
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.BackSide,
  });
  const leftSpineMaterial = new THREE.MeshStandardMaterial({
    color: "#1a1a1a",
    roughness: 0.6,
    metalness: 0.1,
  });
  const leftRightTopMaterial = new THREE.MeshStandardMaterial({
    color: "#2a2a2a",
    roughness: 0.7,
    metalness: 0.0,
  });
  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: "#111111",
    roughness: 0.7,
    metalness: 0.0,
  });
  const materials = [
    leftRightTopMaterial, // right
    leftSpineMaterial,    // left (spine)
    leftRightTopMaterial, // top
    bottomMaterial,       // bottom
    frontMaterial,        // front
    backMaterial,         // back
  ];

  return (
    <group ref={groupRef} frustumCulled={true}>
      {/* Ambient occlusion shadow */}
      <mesh position={[0, 0, shadowOffset[2]]} frustumCulled={true}>
        <planeGeometry args={[cardSize * 1.08, cardSize * 1.08]} onUpdate={onUpdateGeom} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* Disc group — renderOrder={-1} forces all disc geometry to render before
          the sleeve so sleeve correctly occludes the disc via depth test */}
      <group ref={discGroupRef} frustumCulled={true}>
        <group ref={recordTransformRef} position={[0, 0, 0]} frustumCulled={true}>

          {/* Disc body cylinder */}
          <mesh rotation={[Math.PI / 2, 0, 0]} frustumCulled={true} renderOrder={-1}>
            <cylinderGeometry args={[cardSize * 0.44, cardSize * 0.44, 0.04, 64]} onUpdate={onUpdateGeom} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.15} metalness={0.8} />
          </mesh>

          {/* Picture disc face — CircleGeometry, correct UV, MeshBasicMaterial immune to lighting */}
          <mesh position={[0, 0, 0.021]} frustumCulled={true} renderOrder={-1}>
            <circleGeometry args={[cardSize * 0.44, 64]} />
            <meshBasicMaterial map={albumTexture} />
          </mesh>

          {/* Groove rings — outer zone */}
          {[0.43, 0.41, 0.39, 0.37, 0.35, 0.33, 0.31, 0.29].map((r, i) => (
            <mesh key={`og-${i}`} position={[0, 0, 0.023]} frustumCulled={true} renderOrder={-1}>
              <torusGeometry args={[cardSize * r, cardSize * 0.002, 4, 80]} />
              <meshBasicMaterial color="#000" transparent opacity={0.32} />
            </mesh>
          ))}

          {/* Label border ring — prominent chrome outline */}
          <mesh position={[0, 0, 0.024]} frustumCulled={true} renderOrder={-1}>
            <torusGeometry args={[cardSize * 0.195, cardSize * 0.006, 6, 80]} />
            <meshBasicMaterial color="#c8c8c8" transparent opacity={0.85} />
          </mesh>

          {/* Label area tint */}
          <mesh position={[0, 0, 0.0215]} frustumCulled={true} renderOrder={-1}>
            <circleGeometry args={[cardSize * 0.19, 48]} />
            <meshBasicMaterial color="#000" transparent opacity={0.18} />
          </mesh>

          {/* Inner label ring */}
          <mesh position={[0, 0, 0.0245]} frustumCulled={true} renderOrder={-1}>
            <torusGeometry args={[cardSize * 0.165, cardSize * 0.003, 4, 80]} />
            <meshBasicMaterial color="#aaa" transparent opacity={0.55} />
          </mesh>

          {/* Spindle hole */}
          <mesh position={[0, 0, 0.026]} frustumCulled={true} renderOrder={-1}>
            <circleGeometry args={[cardSize * 0.055, 24]} />
            <meshBasicMaterial color="#060606" />
          </mesh>

          {/* Spindle chrome rim */}
          <mesh position={[0, 0, 0.0255]} frustumCulled={true} renderOrder={-1}>
            <torusGeometry args={[cardSize * 0.056, cardSize * 0.004, 4, 32]} />
            <meshBasicMaterial color="#bbb" transparent opacity={0.7} />
          </mesh>

        </group>
      </group>

      {/* Album cover card (sleeve) — renders at default renderOrder=0, after disc */}
      <mesh
        onPointerOver={isBlurred ? undefined : onPointerOver}
        onPointerOut={isBlurred ? undefined : onPointerOut}
        onClick={isBlurred ? undefined : handleClick}
        material={materials}
        castShadow
        receiveShadow
        frustumCulled={true}
      >
        <boxGeometry args={[cardSize, cardSize, cardDepth]} onUpdate={onUpdateGeom} />
      </mesh>

      {/* Bevel highlight strips */}
      <mesh position={[0, cardSize / 2 - 0.03, cardDepth / 2 + 0.002]} frustumCulled={true}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial ref={topBevelRef} color="#fff" transparent opacity={0.18} roughness={0.0} metalness={0.8} />
      </mesh>
      <mesh position={[0, -cardSize / 2 + 0.03, cardDepth / 2 + 0.002]} frustumCulled={true}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial ref={bottomBevelRef} color="#fff" transparent opacity={0.12} roughness={0.0} metalness={0.8} />
      </mesh>
      <mesh position={[-cardSize / 2 + 0.03, 0, cardDepth / 2 + 0.002]} rotation={[0, 0, Math.PI / 2]} frustumCulled={true}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial ref={leftBevelRef} color="#fff" transparent opacity={0.12} roughness={0.0} metalness={0.8} />
      </mesh>
      <mesh position={[cardSize / 2 - 0.03, 0, cardDepth / 2 + 0.002]} rotation={[0, 0, Math.PI / 2]} frustumCulled={true}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial ref={rightBevelRef} color="#fff" transparent opacity={0.12} roughness={0.0} metalness={0.8} />
      </mesh>

      {/* Border */}
      <mesh position={[0, 0, cardDepth / 2 + 0.004]} frustumCulled={true}>
        <planeGeometry args={[cardSize - borderInset * 2, cardSize - borderInset * 2]} onUpdate={onUpdateGeom} />
        <meshBasicMaterial color="#fff" transparent opacity={0.08} />
      </mesh>

    </group>
  );
}
