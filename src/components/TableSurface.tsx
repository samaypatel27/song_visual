"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { WALL_WIDTH, WALL_HEIGHT, WALL_POSITION, WALL_ROTATION } from "./wallConstants";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// Image dimensions
const IMAGE_WIDTH = 1312;
const IMAGE_HEIGHT = 744;
const ASPECT_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT; // ≈ 1.763

export const TableSurface = () => {
  // Get camera and viewport info
  const { camera, size } = useThree();


  // Table geometry and placement derived from wall
  const wallWidth = WALL_WIDTH;
  const wallHeight = WALL_HEIGHT;
  const wallPos = WALL_POSITION;
  const wallRot = WALL_ROTATION;

  // Table width matches wall width exactly
  const planeWidth = wallWidth;
  // Table height: preserve aspect ratio, clamp to 15–25% of wall height
  let planeHeight = planeWidth / ASPECT_RATIO;
  const minHeight = wallHeight * 0.15;
  const maxHeight = wallHeight * 0.25;
  if (planeHeight < minHeight) planeHeight = minHeight;
  if (planeHeight > maxHeight) planeHeight = maxHeight;

  // Wall bottom edge Y
  const wallBottomEdgeY = wallPos[1] - wallHeight / 2;
  // Table center Y so that table top edge touches wall bottom edge
  const tableCenterY = wallBottomEdgeY + planeHeight / 2;
  // Table Z: just in front of wall to avoid z-fighting
  const tableZ = wallPos[2] + 0.01;
  // Table rotation matches wall
  // Ensure rotation is a 3-element array (Euler angles)
  const tableRot: [number, number, number] = [wallRot[0], wallRot[1], wallRot[2]];

  // Load texture
  const tableTexture = useTexture("/table-bgrd.png");
  tableTexture.colorSpace = THREE.SRGBColorSpace;
  tableTexture.minFilter = THREE.LinearFilter;
  tableTexture.magFilter = THREE.LinearFilter;

  useEffect(() => {
    // Placement verification logs
    console.log('[TableSurface] wall bottom edge Y:', wallBottomEdgeY);
    console.log('[TableSurface] table center Y:', tableCenterY);
    console.log('[TableSurface] table top edge Y:', tableCenterY + planeHeight / 2);
    console.log('[TableSurface] match check — gap:', wallBottomEdgeY - (tableCenterY + planeHeight / 2), '(should be 0)');
    console.log('[TableSurface] width match — wall:', wallWidth, '| table:', planeWidth, '| diff:', wallWidth - planeWidth, '(should be 0)');
  }, [wallBottomEdgeY, tableCenterY, planeHeight, wallWidth, planeWidth]);

  return (
    <group>
      {/* Drop shadow plane */}
      <mesh position={[0, tableCenterY - planeHeight * 0.08, tableZ - 0.01]} rotation={tableRot}>
        <planeGeometry args={[planeWidth * 1.08, planeHeight * 0.32]} />
        <meshBasicMaterial color="#000" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {/* Table surface image */}
      <mesh position={[0, tableCenterY, tableZ]} rotation={tableRot}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial
          map={tableTexture}
          color="#fff"
          roughness={0.8}
          metalness={0.0}
          transparent={true}
          alphaTest={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
