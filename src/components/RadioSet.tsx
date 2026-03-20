"use client";

import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface RadioSetProps {
  sceneWidth?: number; // world units wide — default 28.8
}

export const RadioSet = ({ sceneWidth = 28.8 }: RadioSetProps) => {
  const radioTexture = useTexture("/radio-set.png");

  // Set texture properties for optimal rendering
  radioTexture.colorSpace = THREE.SRGBColorSpace;
  radioTexture.minFilter = THREE.LinearFilter;
  radioTexture.magFilter = THREE.LinearFilter;

  // Image dimensions: 2062 x 1162 pixels
  const aspectRatio = 2062 / 1162; // ≈ 1.7757

  // Calculate plane dimensions based on scene width and aspect ratio
  const planeWidth = sceneWidth; // 28.8 world units
  const planeHeight = planeWidth / aspectRatio; // ≈ 16.2 world units

  // Position at bottom of scene with padding
  // Bottom of visible scene at fov=70, camera z=22 is approximately y = -10.5
  // Place the TOP edge of the radio plane at the bottom of the disc area
  const bottomY = -10.5 + planeHeight / 2 + 0.3;

  // Tilt rotation toward camera (approximately 7 degrees on X axis)
  const tiltRotation = -0.12;

  return (
    <group>
      {/* Shadow plane — grounding effect beneath radio set */}
      <mesh position={[0, bottomY - planeHeight * 0.04, 1.0]} rotation={[tiltRotation, 0, 0]}>
        <planeGeometry args={[planeWidth * 1.08, planeHeight * 0.25]} />
        <meshBasicMaterial
          color="#000000"
          transparent={true}
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>

      {/* Radio set image plane */}
      <mesh position={[0, bottomY, 1.2]} rotation={[tiltRotation, 0, 0]}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial
          map={radioTexture}
          color="#ffffff"
          roughness={0.75}
          metalness={0.0}
          transparent={true}
          alphaTest={0.1}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
};
