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


export function AlbumCover({ albumCoverUrl, position, trackCount, index, scale = 1 }: AlbumCoverProps) {
  const groupRef = useRef<THREE.Group>(null);
  const discGroupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const cardSize = getCardSize(trackCount);
  const cardDepth = 0.22;
  const borderInset = 0.04 * cardSize; // 4% inset
  const borderThickness = 0.015; // ~1.5px at world scale
  const shadowOffset = [0, 0, -0.02]; // for AO shadow
  const wallColor = "#d0cfc8"; // match wall background for corner mask

  // For bevel highlight animation
  const [bevelOpacity, setBevelOpacity] = useState(0.12);
  const [topBevelOpacity, setTopBevelOpacity] = useState(0.18);
  // For record slide animation
  const [recordSlide, setRecordSlide] = useState(0);

  // Album art texture
  const albumTexture = useTexture(albumCoverUrl);
  albumTexture.colorSpace = THREE.SRGBColorSpace;
  albumTexture.minFilter = THREE.LinearFilter;
  albumTexture.magFilter = THREE.LinearFilter;

  // Animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const phase = index * GOLDEN;
    // Jiggle: Z rotation (no static tilt)
    const jiggleAmp = hovered ? (Math.PI / 180) * 8 : (Math.PI / 180) * 4;
    const microAmp = hovered ? (Math.PI / 180) * 2 : (Math.PI / 180) * 1;
    const jiggle = Math.sin((t + phase) * JIGGLE_FREQ * 2 * Math.PI) * jiggleAmp;
    const micro = Math.sin((t + phase * 0.7) * MICRO_FREQ * 2 * Math.PI) * microAmp;
    const floatY = Math.sin((t + phase * 0.3) * FLOAT_FREQ * 2 * Math.PI) * 0.1;
    // Scale
    const targetScale = (hovered ? 1.1 : 1.0) * scale;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, 1), 0.18);
    // Rotation — always upright, only animated Z
    groupRef.current.rotation.set(0, 0, jiggle + micro);
    // Position
    groupRef.current.position.set(position[0], position[1] + floatY, position[2]);
    // Animate bevel highlight
    setBevelOpacity((prev) => prev + ((hovered ? 0.22 : 0.12) - prev) * 0.18);
    setTopBevelOpacity((prev) => prev + ((hovered ? 0.28 : 0.18) - prev) * 0.18);
    // Animate record slide
    setRecordSlide((prev) => prev + ((hovered ? 0.08 : 0) - prev) * 0.18);
    // Hide disc in idle state
    if (discGroupRef.current) {
      discGroupRef.current.visible = false;
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
    <group ref={groupRef}>
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
