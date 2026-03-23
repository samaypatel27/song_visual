import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
  const cardSize = getCardSize(trackCount);
  const cardDepth = 0.22;
  const borderInset = 0.04 * cardSize;
  const shadowOffset = [0, 0, -0.02];
  const cameraZ = 22;
  const sleeveZ = 4.0;
  const discZ = 3.7;
  const fov = 70 * Math.PI / 180;
  const aspect = window.innerWidth / window.innerHeight;
  const visibleHeight = 2 * Math.tan(fov / 2) * (cameraZ - sleeveZ);
  const visibleWidth = visibleHeight * aspect;
  const baseSleeveWidth = cardSize;
  const targetSleeveWorldWidth = visibleWidth * 0.38;
  const expandedScale = targetSleeveWorldWidth / baseSleeveWidth;
  const expandedTarget = [(-visibleWidth / 3), 0, sleeveZ];
  const collapsedTarget = [position[0], position[1], position[2]];
  const expandedRotY = -0.22;
  const collapsedRotY = 0;
  const expandedDiscX = targetSleeveWorldWidth * 0.75;
  const collapsedDiscX = targetSleeveWorldWidth * 0.1;
  const albumTexture = useTexture(albumCoverUrl);
  albumTexture.colorSpace = THREE.SRGBColorSpace;
  albumTexture.minFilter = THREE.LinearFilter;
  albumTexture.magFilter = THREE.LinearFilter;

  useFrame(() => {
    const targetPos = isExpanded ? expandedTarget : collapsedTarget;
    const targetScale = isExpanded ? expandedScale : scale;
    const targetRotY = isExpanded ? expandedRotY : collapsedRotY;
    setCurrentPos(prev => [
      prev[0] + (targetPos[0] - prev[0]) * 0.08,
      prev[1] + (targetPos[1] - prev[1]) * 0.08,
      prev[2] + (targetPos[2] - prev[2]) * 0.08,
    ]);
    setCurrentScale(prev => prev + (targetScale - prev) * 0.08);
    setCurrentRotY(prev => prev + (targetRotY - prev) * 0.08);
    setBevelOpacity((prev) => prev + ((hovered ? 0.22 : 0.12) - prev) * 0.18);
    setTopBevelOpacity((prev) => prev + ((hovered ? 0.28 : 0.18) - prev) * 0.18);
    const distToTarget = Math.sqrt(
      Math.pow(currentPos[0] - expandedTarget[0], 2) +
      Math.pow(currentPos[1] - expandedTarget[1], 2) +
      Math.pow(currentPos[2] - expandedTarget[2], 2)
    );
    if (isExpanded && distToTarget < 0.15) {
      setDiscVisible(true);
      setRecordSlide(prev => prev + (expandedDiscX - prev) * 0.12);
      setDiscScale(prev => prev + (1.12 - prev) * 0.09);
      setDiscSpin(prev => prev + 0.009);
    } else {
      setRecordSlide(prev => prev + (collapsedDiscX - prev) * 0.12);
      setDiscScale(prev => prev + (1.0 - prev) * 0.09);
      setDiscSpin(prev => prev + 0.003);
      if (!isExpanded && Math.abs(recordSlide - collapsedDiscX) < 0.1) {
        setDiscVisible(false);
      }
    }
    if (discGroupRef.current) {
      discGroupRef.current.visible = discVisible;
    }
  });

  const onPointerOver = () => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = () => {
    setHovered(false);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (onExpand) onExpand();
  };

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
  const spineEdgeMaterial = new THREE.MeshStandardMaterial({
    color: "#3a3a3a",
    roughness: 0.2,
    metalness: 0.2,
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
    <group
      ref={groupRef}
      position={currentPos}
      scale={currentScale}
      rotation={[0, currentRotY, 0]}
      onClick={handleClick}
    >
      {/* Ambient occlusion shadow at wall contact */}
      <mesh position={[0, 0, shadowOffset[2]]}>
        <planeGeometry args={[cardSize * 1.08, cardSize * 1.08]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      {/* Vinyl disc group — hidden in idle state, visible only on expand */}
      <group ref={discGroupRef}>
        {/* Main disc */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[cardSize / 2 + cardSize * 0.44 * 0.1 + recordSlide, 0, cardDepth * 0.3]}>
          <cylinderGeometry args={[cardSize * 0.44, cardSize * 0.44, 0.04, 48]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.12} metalness={0.85} />
        </mesh>
        {/* Groove rings */}
        {[0.28, 0.36, 0.42].map((r, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]} position={[cardSize / 2 + cardSize * 0.44 * 0.1 + recordSlide, 0, cardDepth * 0.3]}>
            <torusGeometry args={[cardSize * r, 0.008, 8, 32]} />
            <meshStandardMaterial color="#2a2a3e" roughness={0.05} metalness={1.0} />
          </mesh>
        ))}
        {/* Vinyl Inner Label */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[cardSize / 2 + cardSize * 0.44 * 0.1 + recordSlide, 0, cardDepth * 0.3]}>
          <cylinderGeometry args={[cardSize * 0.15, cardSize * 0.15, 0.042, 32]} />
          <meshStandardMaterial map={albumTexture} roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Spindle Hole */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[cardSize / 2 + cardSize * 0.44 * 0.1 + recordSlide, 0, cardDepth * 0.3]}>
          <cylinderGeometry args={[cardSize * 0.015, cardSize * 0.015, 0.045, 16]} />
          <meshBasicMaterial color="#111" />
        </mesh>
      </group>

      {/* Album cover card (sleeve) */}
      <mesh
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        geometry={new THREE.BoxGeometry(cardSize, cardSize, cardDepth)}
        material={materials}
        castShadow
        receiveShadow
      />

      {/* Beveled/rounded edge highlight strips */}
      {/* Top */}
      <mesh position={[0, cardSize / 2 - 0.03, cardDepth / 2 + 0.002]}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} />
        <meshStandardMaterial color="#fff" transparent opacity={topBevelOpacity} roughness={0.0} metalness={0.8} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -cardSize / 2 + 0.03, cardDepth / 2 + 0.002]}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} />
        <meshStandardMaterial color="#fff" transparent opacity={bevelOpacity} roughness={0.0} metalness={0.8} />
      </mesh>
      {/* Left */}
      <mesh position={[-cardSize / 2 + 0.03, 0, cardDepth / 2 + 0.002]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} />
        <meshStandardMaterial color="#fff" transparent opacity={bevelOpacity} roughness={0.0} metalness={0.8} />
      </mesh>
      {/* Right */}
      <mesh position={[cardSize / 2 - 0.03, 0, cardDepth / 2 + 0.002]} rotation={[0, 0, Math.PI / 2]}>
        <planeGeometry args={[cardSize - 0.08, 0.06]} />
        <meshStandardMaterial color="#fff" transparent opacity={bevelOpacity} roughness={0.0} metalness={0.8} />
      </mesh>

      {/* Subtle white border (inset plane) */}
      <mesh position={[0, 0, cardDepth / 2 + 0.004]}>
        <planeGeometry args={[cardSize - borderInset * 2, cardSize - borderInset * 2]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.08} />
      </mesh>

    </group>
  );
}
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
  isExpanded?: boolean;
  isBlurred?: boolean;
  albumName?: string;
  onExpand?: () => void;
}

<<<<<<< HEAD
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

=======

export function AlbumCover({ albumCoverUrl, position, trackCount, index, scale = 1, isExpanded = false, isBlurred = false, albumName, onExpand }: AlbumCoverProps) {
  const groupRef = useRef<THREE.Group>(null);
  const discGroupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [currentPos, setCurrentPos] = useState<[number, number, number]>(position);
  const [currentScale, setCurrentScale] = useState(scale);
  const [currentRotY, setCurrentRotY] = useState(0);
  const [currentZ, setCurrentZ] = useState(position[2]);
  const [bevelOpacity, setBevelOpacity] = useState(0.12);
  const [topBevelOpacity, setTopBevelOpacity] = useState(0.18);
  const [recordSlide, setRecordSlide] = useState(0);
  const [discSpin, setDiscSpin] = useState(0);
  const [discVisible, setDiscVisible] = useState(false);
  const [discScale, setDiscScale] = useState(1.0);
  const cardSize = getCardSize(trackCount);
  const cardDepth = 0.22;
  const borderInset = 0.04 * cardSize;
  const shadowOffset = [0, 0, -0.02];
  const wallColor = "#d0cfc8";
  const cameraZ = 22;
  const sleeveZ = 4.0;
  const discZ = 3.7;
  const fov = 70 * Math.PI / 180;
  const aspect = window.innerWidth / window.innerHeight;
  const visibleHeight = 2 * Math.tan(fov / 2) * (cameraZ - sleeveZ);
  const visibleWidth = visibleHeight * aspect;
  const baseSleeveWidth = cardSize; // at scale 1.0
  const targetSleeveWorldWidth = visibleWidth * 0.38;
  const expandedScale = targetSleeveWorldWidth / baseSleeveWidth;
  const expandedTarget = [(-visibleWidth / 3), 0, sleeveZ];
  const collapsedTarget = [position[0], position[1], position[2]];
  const expandedRotY = -0.22;
  const collapsedRotY = 0;
  const expandedDiscX = targetSleeveWorldWidth * 0.75;
  const collapsedDiscX = targetSleeveWorldWidth * 0.1;
>>>>>>> ba22191 (added vinyl zoom)
  // Album art texture
  const albumTexture = useTexture(albumCoverUrl);
  albumTexture.colorSpace = THREE.SRGBColorSpace;
  albumTexture.minFilter = THREE.LinearFilter;
  albumTexture.magFilter = THREE.LinearFilter;

  // Animation
<<<<<<< HEAD
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
      Math.abs(currentScaleRef.current - targetScale) > 0.001 || 
      Math.abs(recordSlideRef.current - (isHovered ? 1 : 0)) > 0.005;

    // 2. Idle State Mathematics Silence
    if (!isHovered && !isTransitioning) {
      groupRef.current.scale.set(targetScale, targetScale, 1);
      groupRef.current.rotation.set(0, 0, 0); // Reset rotational static noise
      groupRef.current.position.set(position[0], position[1], position[2]); // Rest native
      
      recordSlideRef.current = 0;
      if (recordTransformRef.current) {
        recordTransformRef.current.position.x = 0;
      }

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
      ((isHovered ? 1 : 0) - recordSlideRef.current) * 0.12; // Slightly slower pulling-out effect
    if (recordTransformRef.current) {
      // The disc starts at perfectly 0 (hidden exactly inside the sleeve) and slides out to the right. 
      // Changed from 0.65 to 0.45 to make it pop out less:
      recordTransformRef.current.position.x =
        (cardSize * 0.55) * recordSlideRef.current;
=======
  useFrame(() => {
    // Animate position, scale, rotation, Z
    const targetPos = isExpanded ? expandedTarget : collapsedTarget;
    const targetScale = isExpanded ? expandedScale : scale;
    const targetRotY = isExpanded ? expandedRotY : collapsedRotY;
    const targetZ = isExpanded ? sleeveZ : position[2];
    setCurrentPos(prev => [
      prev[0] + (targetPos[0] - prev[0]) * 0.08,
      prev[1] + (targetPos[1] - prev[1]) * 0.08,
      prev[2] + (targetZ - prev[2]) * 0.08,
    ]);
    setCurrentScale(prev => prev + (targetScale - prev) * 0.08);
    setCurrentRotY(prev => prev + (targetRotY - prev) * 0.08);
    // Animate bevel highlight
    setBevelOpacity((prev) => prev + ((hovered ? 0.22 : 0.12) - prev) * 0.18);
    setTopBevelOpacity((prev) => prev + ((hovered ? 0.28 : 0.18) - prev) * 0.18);
    // Disc slide-out logic
    const distToTarget = Math.sqrt(
      Math.pow(currentPos[0] - expandedTarget[0], 2) +
      Math.pow(currentPos[1] - expandedTarget[1], 2) +
      Math.pow(currentPos[2] - expandedTarget[2], 2)
    );
    if (isExpanded && distToTarget < 0.15) {
      setDiscVisible(true);
      setRecordSlide(prev => prev + (expandedDiscX - prev) * 0.12);
      setDiscScale(prev => prev + (1.12 - prev) * 0.09);
      setDiscSpin(prev => prev + 0.009);
    } else {
      setRecordSlide(prev => prev + (collapsedDiscX - prev) * 0.12);
      setDiscScale(prev => prev + (1.0 - prev) * 0.09);
      setDiscSpin(prev => prev + 0.003);
      if (!isExpanded && Math.abs(recordSlide - collapsedDiscX) < 0.1) {
        setDiscVisible(false);
      }
    }
    // Hide disc in idle/collapsed state
    if (discGroupRef.current) {
      discGroupRef.current.visible = discVisible;
    }
    // Log expanded state
    if (isExpanded && albumName) {
      // eslint-disable-next-line no-console
      console.log(`[AlbumCover] expanded | targetX: ${(-visibleWidth / 3).toFixed(2)} | targetScale: ${expandedScale.toFixed(2)} | visibleWidth: ${visibleWidth.toFixed(2)}`);
>>>>>>> ba22191 (added vinyl zoom)
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
  const handleClick = (e: any) => {
    e.stopPropagation();
    if (onExpand) onExpand();
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
  const leftSpineMaterial = new THREE.MeshStandardMaterial({
    color: "#1a1a1a",
    roughness: 0.6,
    metalness: 0.1,
  });
  const spineEdgeMaterial = new THREE.MeshStandardMaterial({
    color: "#3a3a3a",
    roughness: 0.2,
    metalness: 0.2,
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
<<<<<<< HEAD
    <group ref={groupRef} frustumCulled={true}>
=======
    <group
      ref={groupRef}
      position={currentPos}
      scale={currentScale}
      rotation={[0, currentRotY, 0]}
      onClick={handleClick}
    >
>>>>>>> ba22191 (added vinyl zoom)
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
          position={[0, 0, cardDepth * 0.3]}
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
