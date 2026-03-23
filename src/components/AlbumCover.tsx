"use client";

import { useRef, useEffect } from "react";
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

export interface AlbumCoverProps {
  albumCoverUrl: string;
  position: [number, number, number];
  trackCount: number;
  index: number;
  scale?: number;
}

export function AlbumCover({
  albumCoverUrl,
  position,
  trackCount,
  index,
  scale = 1,
}: AlbumCoverProps) {
  const groupRef = useRef<THREE.Group>(null);
  const discGroupRef = useRef<THREE.Group>(null);
  const recordTransformRef = useRef<THREE.Group>(null);

  const cardSize = getCardSize(trackCount);
  const cardDepth = 0.22;
  const borderInset = 0.04 * cardSize; // 4% inset
  const shadowOffset = [0, 0, -0.02]; // for AO shadow

  // Refs for tracking animation state cleanly without reacting
  const hoveredRef = useRef(false);
  const bevelOpacityRef = useRef(0.12);
  const topBevelOpacityRef = useRef(0.18);
  const recordSlideRef = useRef(0);
  const currentScaleRef = useRef(scale);

  // Material refs for rapid UI mutations without component re-renders
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

    // 1. Core Frustum Culling Extraction
    _projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    _frustum.setFromProjectionMatrix(_projScreenMatrix);
    _sphere.set(groupRef.current.position, cardSize);

    if (!_frustum.intersectsSphere(_sphere)) {
      return; // Mesh outside camera view; immediately return
    }

    const isHovered = hoveredRef.current;
    const targetScale = (isHovered ? 1.1 : 1.0) * scale;
    const isTransitioning =
      Math.abs(currentScaleRef.current - targetScale) > 0.001;

    // 2. Idle State Mathematics Silence
    if (!isHovered && !isTransitioning) {
      groupRef.current.scale.set(targetScale, targetScale, 1);
      groupRef.current.rotation.set(0, 0, 0); // Reset rotational static noise
      groupRef.current.position.set(position[0], position[1], position[2]); // Rest native

      if (discGroupRef.current) {
        discGroupRef.current.visible = false;
      }
      return; // Math execution explicitly skipped for idle nodes
    }

    // Node is active/hovering/visible -> run Math
    if (discGroupRef.current && isTransitioning) {
      discGroupRef.current.visible = true;
    }

    const t = clock.getElapsedTime();
    const phase = index * GOLDEN;

    // Transform Physics
    const jiggleAmp = isHovered ? (Math.PI / 180) * 8 : (Math.PI / 180) * 4;
    const microAmp = isHovered ? (Math.PI / 180) * 2 : (Math.PI / 180) * 1;
    const jiggle =
      Math.sin((t + phase) * JIGGLE_FREQ * 2 * Math.PI) * jiggleAmp;
    const micro =
      Math.sin((t + phase * 0.7) * MICRO_FREQ * 2 * Math.PI) * microAmp;
    const floatY = Math.sin((t + phase * 0.3) * FLOAT_FREQ * 2 * Math.PI) * 0.1;

    // Positional mutations
    currentScaleRef.current += (targetScale - currentScaleRef.current) * 0.18;
    groupRef.current.scale.set(
      currentScaleRef.current,
      currentScaleRef.current,
      1,
    );
    groupRef.current.rotation.set(0, 0, jiggle + micro);
    groupRef.current.position.set(
      position[0],
      position[1] + floatY,
      position[2],
    );

    // Opacity / Side Effects Ref Mutations
    bevelOpacityRef.current +=
      ((isHovered ? 0.22 : 0.12) - bevelOpacityRef.current) * 0.18;
    topBevelOpacityRef.current +=
      ((isHovered ? 0.28 : 0.18) - topBevelOpacityRef.current) * 0.18;

    if (topBevelRef.current)
      topBevelRef.current.opacity = topBevelOpacityRef.current;
    if (bottomBevelRef.current)
      bottomBevelRef.current.opacity = bevelOpacityRef.current;
    if (leftBevelRef.current)
      leftBevelRef.current.opacity = bevelOpacityRef.current;
    if (rightBevelRef.current)
      rightBevelRef.current.opacity = bevelOpacityRef.current;

    recordSlideRef.current +=
      ((isHovered ? 0.08 : 0) - recordSlideRef.current) * 0.18;
    if (recordTransformRef.current) {
      recordTransformRef.current.position.x =
        cardSize / 2 + cardSize * 0.44 * 0.1 + recordSlideRef.current;
    }
  });

  // Pointer events hook
  const onPointerOver = () => {
    hoveredRef.current = true;
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = () => {
    hoveredRef.current = false;
    document.body.style.cursor = "default";
  };

  const onUpdateGeom = (geom: any) => {
    if (geom) {
      geom.computeBoundingSphere();
      geom.computeBoundingBox();
    }
  };

  // Materials map
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
    leftRightTopMaterial, // left
    leftRightTopMaterial, // top
    bottomMaterial, // bottom
    frontMaterial, // front
    backMaterial, // back
  ];

  return (
    <group ref={groupRef} frustumCulled={true}>
      {/* Ambient occlusion shadow at wall contact */}
      <mesh position={[0, 0, shadowOffset[2]]} frustumCulled={true}>
        <planeGeometry
          args={[cardSize * 1.08, cardSize * 1.08]}
          onUpdate={onUpdateGeom}
        />
        <meshBasicMaterial
          color="#000"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>

      {/* Record peeking out from right side */}
      <group ref={discGroupRef} frustumCulled={true}>
        <group
          ref={recordTransformRef}
          position={[cardSize / 2 + cardSize * 0.44 * 0.1, 0, cardDepth * 0.3]}
          frustumCulled={true}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} frustumCulled={true}>
            <cylinderGeometry
              args={[cardSize * 0.44, cardSize * 0.44, 0.04, 48]}
              onUpdate={onUpdateGeom}
            />
            <meshStandardMaterial
              color="#0a0a0a"
              roughness={0.12}
              metalness={0.85}
            />
          </mesh>
          
          {/* Vinyl Inner Label */}
          <mesh rotation={[Math.PI / 2, 0, 0]} frustumCulled={true}>
            <cylinderGeometry
              args={[cardSize * 0.15, cardSize * 0.15, 0.042, 32]}
              onUpdate={onUpdateGeom}
            />
            <meshStandardMaterial
              map={albumTexture}
              roughness={0.8}
              metalness={0.1}
            />
          </mesh>

          {/* Spindle Hole */}
          <mesh rotation={[Math.PI / 2, 0, 0]} frustumCulled={true}>
            <cylinderGeometry
              args={[cardSize * 0.015, cardSize * 0.015, 0.045, 16]}
              onUpdate={onUpdateGeom}
            />
            <meshBasicMaterial color="#111" />
          </mesh>

        
        </group>
      </group>

      {/* Album cover card (sleeve) */}
      <mesh
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        material={materials}
        castShadow
        receiveShadow
        frustumCulled={true}
      >
        <boxGeometry
          args={[cardSize, cardSize, cardDepth]}
          onUpdate={onUpdateGeom}
        />
      </mesh>

      {/* Beveled/rounded edge highlight strips */}
      {/* Top */}
      <mesh
        position={[0, cardSize / 2 - 0.03, cardDepth / 2 + 0.002]}
        frustumCulled={true}
      >
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial
          ref={topBevelRef}
          color="#fff"
          transparent
          opacity={0.18}
          roughness={0.0}
          metalness={0.8}
        />
      </mesh>
      {/* Bottom */}
      <mesh
        position={[0, -cardSize / 2 + 0.03, cardDepth / 2 + 0.002]}
        frustumCulled={true}
      >
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial
          ref={bottomBevelRef}
          color="#fff"
          transparent
          opacity={0.12}
          roughness={0.0}
          metalness={0.8}
        />
      </mesh>
      {/* Left */}
      <mesh
        position={[-cardSize / 2 + 0.03, 0, cardDepth / 2 + 0.002]}
        rotation={[0, 0, Math.PI / 2]}
        frustumCulled={true}
      >
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial
          ref={leftBevelRef}
          color="#fff"
          transparent
          opacity={0.12}
          roughness={0.0}
          metalness={0.8}
        />
      </mesh>
      {/* Right */}
      <mesh
        position={[cardSize / 2 - 0.03, 0, cardDepth / 2 + 0.002]}
        rotation={[0, 0, Math.PI / 2]}
        frustumCulled={true}
      >
        <planeGeometry args={[cardSize - 0.08, 0.06]} onUpdate={onUpdateGeom} />
        <meshStandardMaterial
          ref={rightBevelRef}
          color="#fff"
          transparent
          opacity={0.12}
          roughness={0.0}
          metalness={0.8}
        />
      </mesh>

      {/* Subtle white border (inset plane) */}
      <mesh position={[0, 0, cardDepth / 2 + 0.004]} frustumCulled={true}>
        <planeGeometry
          args={[cardSize - borderInset * 2, cardSize - borderInset * 2]}
          onUpdate={onUpdateGeom}
        />
        <meshBasicMaterial color="#fff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}
