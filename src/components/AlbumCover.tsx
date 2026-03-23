"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// Sizing logic: use the same as getDiscRadius
const getCardSize = (trackCount: number) => Math.min(1.8 + (trackCount - 1) * 0.45, 4.2) * 2; // diameter to square side

// No static random tilt for album covers — all upright

// Animation frequencies (incommensurable)
const JIGGLE_FREQ = 1 / 3; // ~3s
const MICRO_FREQ = 1 / 0.8; // ~0.8s
const FLOAT_FREQ = 1 / 4; // ~4s
const GOLDEN = 1.618;

export interface AlbumCoverProps {
  albumCoverUrl: string;
  position: [number, number, number];
  trackCount: number;
  index: number;
  scale?: number;
}


export function AlbumCover({ albumCoverUrl, position, trackCount, index, scale = 1, isExpanded = false, isBlurred = false, albumName, onExpand }: AlbumCoverProps & { isExpanded?: boolean, isBlurred?: boolean, albumName?: string, onExpand?: () => void }) {
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
  // Album art texture
  const albumTexture = useTexture(albumCoverUrl);
  albumTexture.colorSpace = THREE.SRGBColorSpace;
  albumTexture.minFilter = THREE.LinearFilter;
  albumTexture.magFilter = THREE.LinearFilter;

  // Animation
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
    }
  });

  // On mount, log disc hidden
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[AlbumCover] disc hidden in idle state — visible only on expand");
  }, []);

  // Pointer events
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
        {/* (Other disc geometry like shimmer, label, spindle, shadow would go here if present) */}
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
