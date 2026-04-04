// ── DO NOT READ THIS FILE IN FULL UNLESS REQUIRED ──────────────────────────
// FILE: src/components/ArtistPlaque.tsx
// PURPOSE: Premium "Artist Prestige Award" plaque — cherry mahogany wood frame
//   + directional brushed satin-gold plate + deep-recessed portrait well.
//
// LAYOUT (top → bottom on gold plate):
//   "HALL · OF · FAME" micro-text → thin line → portrait (recessed well) →
//   artist name (large) → award subtitle → divider → achievement list →
//   divider → presented year → bottom flourish
//
// LIGHTING: dual gallery spotlights (above-left / above-right), always-on;
//   back-glow amber pointLight activates on hover.
// MATERIALS: cherry mahogany (#6e1a1a), satin gold (#d4a830, emissive 1.3),
//   black inlay (#0a0503). Gold bands simulate brushed anisotropic reflections.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

export interface ArtistPlaqueProps {
  artistName: string;
  artistImageUrl: string;
  rank: number;
  position: [number, number, number];
  rotationZ: number;
}

function getTier(rank: number) {
  const tiers = [
    // 1st: 24k Gold
    { pColor: "#d4a830", pEmissive: "#9a7218", pInt: 1.3, pMet: 0.55, pRough: 0.22,
      bands: [ {c: "#bf953f", e: "#8a6010"}, {c: "#fcf6ba", e: "#c0b050"}, {c: "#b38728", e: "#806010"}, {c: "#fbf5b7", e: "#c0b050"}, {c: "#aa771c", e: "#705010"} ],
      badge: { color: "#f0d070", emissive: "#5a3800", metalness: 0.97, roughness: 0.04 }, textColor: "#060100", line: {c: "#f0c840", e: "#c09020"} },
    // 2nd: Brushed Sterling Silver
    { pColor: "#a0a0a0", pEmissive: "#505050", pInt: 1.2, pMet: 0.80, pRough: 0.15,
      bands: [ {c: "#757575", e: "#404040"}, {c: "#e0e0e0", e: "#808080"}, {c: "#8e8e8e", e: "#505050"}, {c: "#f5f5f5", e: "#a0a0a0"}, {c: "#9e9e9e", e: "#606060"} ],
      badge: { color: "#e0e0e8", emissive: "#1a1a22", metalness: 0.95, roughness: 0.06 }, textColor: "#060100", line: {c: "#e0e0e0", e: "#808080"} },
    // 3rd: Antique Bronze
    { pColor: "#a1630d", pEmissive: "#502000", pInt: 1.3, pMet: 0.65, pRough: 0.25,
      bands: [ {c: "#804a00", e: "#402000"}, {c: "#edae5a", e: "#a05010"}, {c: "#a1630d", e: "#502000"}, {c: "#e3a857", e: "#904010"}, {c: "#6b4000", e: "#301000"} ],
      badge: { color: "#b87030", emissive: "#2e1e04", metalness: 0.88, roughness: 0.14 }, textColor: "#060100", line: {c: "#e3a857", e: "#904010"} },
    // 4th: Polished Obsidian Chrome
    { pColor: "#111111", pEmissive: "#050505", pInt: 1.0, pMet: 0.95, pRough: 0.03,
      bands: [ {c: "#000000", e: "#000000"}, {c: "#434343", e: "#202020"}, {c: "#000000", e: "#000000"}, {c: "#1a1a1a", e: "#0a0a0a"}, {c: "#000000", e: "#000000"} ],
      badge: { color: "#333333", emissive: "#050505", metalness: 0.95, roughness: 0.05 }, textColor: "#f0f0f0", line: {c: "#434343", e: "#202020"} },
    // 5th: Brushed Midnight Cobalt Steel
    { pColor: "#2c3e50", pEmissive: "#101820", pInt: 1.4, pMet: 0.70, pRough: 0.18,
      bands: [ {c: "#1c2331", e: "#0a1015"}, {c: "#4b5d67", e: "#203038"}, {c: "#2c3e50", e: "#15202a"}, {c: "#1c2331", e: "#0a1015"}, {c: "#3a4c5a", e: "#1a2530"} ],
      badge: { color: "#4b5d67", emissive: "#15202a", metalness: 0.90, roughness: 0.10 }, textColor: "#f0f0f0", line: {c: "#4b5d67", e: "#203038"} }
  ];
  return tiers[Math.min(Math.max(rank - 1, 0), 4)];
}

// ── Dimensions ────────────────────────────────────────────────────────────────
const WW = 4.0,  HW = 7.25,  DW = 0.45;   // cherry wood mount (Scaled up 1.25x)
const WG = 3.20, HG = 6.10, DG = 0.10;   // gold plate (Scaled up 1.25x)
const GOLD_Z = DW / 2 + DG / 2 + 0.005;
const GF     = GOLD_Z + DG / 2;           // gold plate front surface z

// Portrait — upper portion of gold plate
const PHOTO_R = 0.75;  // Scaled 1.25x
const PHOTO_Y = 1.75;
const PHOTO_Z = GF + 0.006;

// Derived layout (top → bottom) (Scaled 1.25x roughly)
const NAME_Y     = -0.10;    // artist name (centered)
const MEDAL_Y    = -1.60;    // medal & ribbon center

function getRibbonColor(rank: number) {
  if (rank === 1) return { main: "#7a0815", trim: "#ffffff" }; // Royal Crimson
  if (rank === 2) return { main: "#0c2860", trim: "#ffffff" }; // Cobalt Blue
  if (rank === 3) return { main: "#10401b", trim: "#ffffff" }; // Forest Emerald
  return { main: "#000000", trim: "#ffffff" };
}

// Corner detail anchor (inside gold plate corners)
const CX = WG / 2 - 0.25;
const CY = HG / 2 - 0.30;

// Brushed-gold band Y positions
const BANDS = [2.30, 1.05, -0.05, -1.15, -2.30];

// Groove strip data [x, y, w, h]
const OUTER_GROOVES: [number,number,number,number][] = [
  [0, HW*0.464, WW*0.90, 0.028], [0, -HW*0.464, WW*0.90, 0.028],
  [-WW*0.448, 0, 0.028, HW*0.90], [WW*0.448, 0, 0.028, HW*0.90],
];
const INNER_GROOVES: [number,number,number,number][] = [
  [0, HW*0.428, WW*0.82, 0.018], [0, -HW*0.428, WW*0.82, 0.018],
  [-WW*0.408, 0, 0.018, HW*0.82], [WW*0.408, 0, 0.018, HW*0.82],
];
const INLAYS: [number,number,number,number][] = [
  [0, HG/2+0.068, WG+0.19, 0.115], [0, -HG/2-0.068, WG+0.19, 0.115],
  [-WG/2-0.078, 0, 0.135, HG+0.045], [WG/2+0.078, 0, 0.135, HG+0.045],
];
const CORNERS: [number,number,number,number][] = [
  [-CX, CY, 1, 1], [CX, CY, -1, 1], [-CX, -CY, 1, -1], [CX, -CY, -1, -1],
];

// ── Component ─────────────────────────────────────────────────────────────────
export function ArtistPlaque({ artistName, artistImageUrl, rank, position, rotationZ }: ArtistPlaqueProps) {
  const groupRef       = useRef<THREE.Group>(null);
  const spotLRef       = useRef<THREE.SpotLight>(null);
  const spotRRef       = useRef<THREE.SpotLight>(null);
  const backGlowRef    = useRef<THREE.PointLight>(null);
  const spotLTarget    = useRef<THREE.Object3D>(new THREE.Object3D());
  const spotRTarget    = useRef<THREE.Object3D>(new THREE.Object3D());

  const hoveredRef  = useRef(false);
  const cursorRef   = useRef({ x: 0, y: 0 });
  const scaleRef    = useRef(1.0);
  const tiltXRef    = useRef(0.0);
  const tiltYRef    = useRef(0.0);
  const spotLInt    = useRef(1.4);
  const spotRInt    = useRef(1.2);
  const backInt     = useRef(0.0);

  const [artistTexture, setArtistTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!artistImageUrl) return;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    const tex = loader.load(
      artistImageUrl,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter  = THREE.LinearMipmapLinearFilter;
        t.magFilter  = THREE.LinearFilter;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        setArtistTexture(t);
      },
      undefined,
      (err) => console.error(`[ArtistPlaque] texture failed for "${artistName}"`, err)
    );
    return () => { tex.dispose(); setArtistTexture(null); };
  }, [artistImageUrl, artistName]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.add(spotLTarget.current);
    g.add(spotRTarget.current);
    spotLTarget.current.position.set(-0.4, 0.5, GF);
    spotRTarget.current.position.set( 0.4, 0.5, GF);
    if (spotLRef.current) spotLRef.current.target = spotLTarget.current;
    if (spotRRef.current) spotRRef.current.target = spotRTarget.current;
  }, []);

  useEffect(() => {
    if (groupRef.current) groupRef.current.rotation.z = rotationZ;
  }, [rotationZ]);

  useFrame((state) => {
    const hovered = hoveredRef.current;
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, hovered ? 1.04 : 1.0, 0.08);
    g.scale.setScalar(scaleRef.current);

    tiltXRef.current = THREE.MathUtils.lerp(tiltXRef.current, hovered ? -cursorRef.current.y * 0.08 : 0, 0.09);
    tiltYRef.current = THREE.MathUtils.lerp(tiltYRef.current, hovered ?  cursorRef.current.x * 0.07 : 0, 0.09);
    g.rotation.x = tiltXRef.current;
    g.rotation.y = tiltYRef.current;

    const swayZ = rotationZ + Math.sin(t * 0.28 + position[0] * 0.5) * 0.004;
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, hovered ? rotationZ : swayZ, 0.02);

    spotLInt.current = THREE.MathUtils.lerp(spotLInt.current, hovered ? 4.5 : 1.4, 0.08);
    spotRInt.current = THREE.MathUtils.lerp(spotRInt.current, hovered ? 3.8 : 1.2, 0.08);
    backInt.current  = THREE.MathUtils.lerp(backInt.current,  hovered ? 1.5 : 0,   0.08);
    if (spotLRef.current)    spotLRef.current.intensity    = spotLInt.current;
    if (spotRRef.current)    spotRRef.current.intensity    = spotRInt.current;
    if (backGlowRef.current) backGlowRef.current.intensity = backInt.current;
  });

  const tier = getTier(rank);

  return (
    <group ref={groupRef} position={position}>

      {/* ── Gallery spotlights — above-left and above-right ── */}
      <spotLight ref={spotLRef} position={[-3, 7.5, 3]} intensity={1.4}
        color="#fff8e0" angle={0.27} penumbra={0.55} distance={18} decay={1.6} castShadow={false} />
      <spotLight ref={spotRRef} position={[ 3, 7.5, 3]} intensity={1.2}
        color="#fffbe0" angle={0.27} penumbra={0.65} distance={18} decay={1.6} castShadow={false} />
      {/* Constant front fill — primary diffuse source */}
      <pointLight position={[0, 0.5, 3.8]} intensity={1.6} color="#fff8e8" distance={10} decay={1.4} />
      <pointLight position={[0, -2.5, 2.5]} intensity={0.5} color="#f0e0b0" distance={8} decay={2} />
      {/* Back-glow on hover */}
      <pointLight ref={backGlowRef} position={[0, 0, -1.5]} intensity={0} color="#c07830" distance={12} decay={2} />

      {/* ── AO shadow on wall ── */}
      <mesh position={[0, 0, -DW/2 - 0.02]} renderOrder={-1}>
        <planeGeometry args={[WW+1.8, HW+2.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.20} depthWrite={false} />
      </mesh>

      {/* ══════════════════════════════════════════
          CHERRY MAHOGANY WOOD FRAME
          ══════════════════════════════════════════ */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[WW, HW, DW]} />
        <meshStandardMaterial color="#6e1a1a" emissive="#280808" emissiveIntensity={0.5} metalness={0.05} roughness={0.44} />
      </mesh>
      {/* Beveled edges — bright rims */}
      {([
        [0, HW/2, 0, WW+0.06, 0.072, DW+0.072, "#bb3535", 0.10, 0.22],
        [0,-HW/2, 0, WW+0.06, 0.072, DW+0.072, "#952525", 0.10, 0.28],
        [-WW/2,0, 0, 0.072, HW, DW+0.072, "#9a2222", 0.10, 0.26],
        [ WW/2,0, 0, 0.072, HW, DW+0.072, "#9a2222", 0.10, 0.26],
      ] as [number,number,number,number,number,number,string,number,number][]).map(([x,y,z,w,h,d,col,m,r],i) => (
        <mesh key={`edge-${i}`} position={[x,y,z]}>
          <boxGeometry args={[w,h,d]} />
          <meshStandardMaterial color={col} metalness={m} roughness={r} />
        </mesh>
      ))}
      {/* Relief grooves — outer */}
      {OUTER_GROOVES.map(([x,y,w,h],i) => (
        <mesh key={`og-${i}`} position={[x,y,DW/2+0.002]}>
          <boxGeometry args={[w,h,0.010]} />
          <meshStandardMaterial color="#3a0c0c" metalness={0.06} roughness={0.55} />
        </mesh>
      ))}
      {/* Relief grooves — inner */}
      {INNER_GROOVES.map(([x,y,w,h],i) => (
        <mesh key={`ig-${i}`} position={[x,y,DW/2+0.003]}>
          <boxGeometry args={[w,h,0.007]} />
          <meshStandardMaterial color="#3a0c0c" metalness={0.06} roughness={0.55} />
        </mesh>
      ))}
      {/* Corner botanical details */}
      {CORNERS.map(([cx,cy,mx,my],i) => (
        <group key={`cor-${i}`} position={[cx,cy,DW/2+0.005]}>
          <mesh position={[mx*-0.13,0,0]}><boxGeometry args={[0.27,0.028,0.010]}/><meshStandardMaterial color="#8a2020" metalness={0.12} roughness={0.38}/></mesh>
          <mesh position={[0,my*-0.13,0]}><boxGeometry args={[0.028,0.27,0.010]}/><meshStandardMaterial color="#8a2020" metalness={0.12} roughness={0.38}/></mesh>
          <mesh position={[0,0,0.005]}><torusGeometry args={[0.072,0.018,8,28]}/><meshStandardMaterial color="#a83030" metalness={0.14} roughness={0.35}/></mesh>
          <mesh position={[0,0,0.009]}><circleGeometry args={[0.030,18]}/><meshStandardMaterial color="#c04040" metalness={0.15} roughness={0.32}/></mesh>
        </group>
      ))}

      {/* ══════════════════════════════════════════
          BLACK INLAY BORDER
          ══════════════════════════════════════════ */}
      {INLAYS.map(([x,y,w,h],i) => (
        <mesh key={`inlay-${i}`} position={[x,y,GOLD_Z]}>
          <boxGeometry args={[w,h,DG+0.03]} />
          <meshStandardMaterial color="#080402" metalness={0.80} roughness={0.20} />
        </mesh>
      ))}

      {/* ══════════════════════════════════════════
          RANK-SPECIFIC METAL PLATE
          ══════════════════════════════════════════ */}
      <mesh position={[0,0,GOLD_Z]}>
        <boxGeometry args={[WG,HG,DG]} />
        <meshStandardMaterial color={tier.pColor} emissive={tier.pEmissive} emissiveIntensity={tier.pInt} metalness={tier.pMet} roughness={tier.pRough} />
      </mesh>
      {/* Directional brushed-metal bands — simulate anisotropic light waves */}
      {BANDS.map((bandY,i) => (
        <mesh key={`band-${i}`} position={[0,bandY,GF+0.0005]}>
          <planeGeometry args={[WG-0.04, 0.44]} />
          <meshStandardMaterial
            color={tier.bands[i].c}
            emissive={tier.bands[i].e}
            emissiveIntensity={0.6}
            metalness={0.88} roughness={0.12}
            transparent opacity={0.25} depthWrite={false}
          />
        </mesh>
      ))}
      {/* Plate rim highlights */}
      <mesh position={[0, HG/2, GOLD_Z]}><boxGeometry args={[WG+0.01,0.030,DG+0.028]}/><meshStandardMaterial color={tier.bands[1].c} emissive={tier.bands[1].e} emissiveIntensity={0.9} metalness={0.95} roughness={0.04}/></mesh>
      <mesh position={[0,-HG/2, GOLD_Z]}><boxGeometry args={[WG+0.01,0.030,DG+0.028]}/><meshStandardMaterial color={tier.bands[0].c} metalness={0.90} roughness={0.08}/></mesh>
      <mesh position={[-WG/2,0,GOLD_Z]}><boxGeometry args={[0.030,HG,DG+0.028]}/><meshStandardMaterial color={tier.pColor} emissive={tier.pEmissive} emissiveIntensity={0.5} metalness={0.92} roughness={0.06}/></mesh>
      <mesh position={[ WG/2,0,GOLD_Z]}><boxGeometry args={[0.030,HG,DG+0.028]}/><meshStandardMaterial color={tier.pColor} emissive={tier.pEmissive} emissiveIntensity={0.5} metalness={0.92} roughness={0.06}/></mesh>

      {/* ══════════════════════════════════════════
          ARTIST PORTRAIT — deeply recessed well
          ══════════════════════════════════════════ */}
      {/* Dark well floor — replaces gold surface inside the bezel area */}
      <mesh position={[0,PHOTO_Y,GF+0.002]}>
        <circleGeometry args={[PHOTO_R+0.092,64]} />
        <meshStandardMaterial color="#080400" metalness={0.15} roughness={0.92} />
      </mesh>
      {/* Shadow collar — dark annular ring (well walls viewed from front) */}
      <mesh position={[0,PHOTO_Y,GF+0.004]}>
        <torusGeometry args={[PHOTO_R+0.040,0.054,6,80]} />
        <meshStandardMaterial color="#030100" metalness={0.3} roughness={0.8} transparent opacity={0.88} />
      </mesh>
      {/* Artist portrait photo */}
      <mesh position={[0,PHOTO_Y,PHOTO_Z]}>
        <circleGeometry args={[PHOTO_R,128]} />
        <meshBasicMaterial key={artistTexture?.uuid??"loading"} map={artistTexture??undefined} color={artistTexture?"#ffffff":"#281808"} />
      </mesh>
      {/* Polished metal bezel — raised proud rim */}
      <mesh position={[0,PHOTO_Y,GF+0.022]}>
        <torusGeometry args={[PHOTO_R+0.042,0.050,12,96]} />
        <meshStandardMaterial color={tier.bands[1].c} emissive={tier.bands[1].e} emissiveIntensity={1.0} metalness={0.75} roughness={0.10} />
      </mesh>
      {/* Inner shadow rim for depth */}
      <mesh position={[0,PHOTO_Y,GF+0.008]}>
        <torusGeometry args={[PHOTO_R+0.002,0.014,6,96]} />
        <meshStandardMaterial color="#030100" metalness={0.5} roughness={0.5} transparent opacity={0.72} />
      </mesh>

      {/* ══════════════════════════════════════════
          TEXT HIERARCHY
          ══════════════════════════════════════════ */}
      {/* Artist name — large, prominent */}
      <Text position={[0,NAME_Y,GF+0.030]} fontSize={0.34} color={tier.textColor} anchorX="center" anchorY="middle" maxWidth={WG-0.14}
        // @ts-ignore
        fontWeight={700}>{artistName.toUpperCase()}</Text>

      {/* ══════════════════════════════════════════
          MEDALLION & SILK RIBBON (Top 3 Only)
          ══════════════════════════════════════════ */}
      {rank <= 3 && (
        <group position={[0, MEDAL_Y, GF + 0.05]}>
          {/* Silk V-Ribbon */}
          {/* Left sash */}
          <group position={[-0.22, 0, 0]} rotation={[0, 0, -0.22]}>
            <mesh position={[0, -0.6, 0.001]}><planeGeometry args={[0.34, 1.4]} /><meshStandardMaterial color={getRibbonColor(rank).trim} roughness={0.9} /></mesh>
            <mesh position={[0, -0.6, 0.002]}><planeGeometry args={[0.26, 1.4]} /><meshStandardMaterial color={getRibbonColor(rank).main} roughness={0.5} /></mesh>
          </group>
          {/* Right sash */}
          <group position={[0.22, 0, 0]} rotation={[0, 0, 0.22]}>
            <mesh position={[0, -0.6, 0.001]}><planeGeometry args={[0.34, 1.4]} /><meshStandardMaterial color={getRibbonColor(rank).trim} roughness={0.9} /></mesh>
            <mesh position={[0, -0.6, 0.002]}><planeGeometry args={[0.26, 1.4]} /><meshStandardMaterial color={getRibbonColor(rank).main} roughness={0.5} /></mesh>
          </group>
          {/* Top cover shadow plane (where it tucks under text) */}
          <mesh position={[0, 0.1, 0.005]}>
            <planeGeometry args={[0.8, 0.2]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.4} depthWrite={false} />
          </mesh>

          {/* Heavy Coin Medallion */}
          <group position={[0, 0, 0.04]}>
            {/* Medallion box shadow */}
            <mesh position={[0, -0.05, -0.02]}>
              <circleGeometry args={[0.48, 32]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.6} depthWrite={false} />
            </mesh>

            {/* Fluted Outer Rim */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.42, 0.42, 0.03, 64]} />
              <meshStandardMaterial color={tier.pColor} emissive={tier.pEmissive} emissiveIntensity={0.8} metalness={0.95} roughness={0.15} />
            </mesh>
            
            {/* Inner Recessed Face */}
            <mesh position={[0, 0, 0.01]}>
              <circleGeometry args={[0.39, 64]} />
              <meshStandardMaterial color={tier.bands[1].c} emissive={tier.bands[1].e} emissiveIntensity={0.6} metalness={0.85} roughness={0.25} />
            </mesh>

            {/* Laurel Wreath Raised Ring */}
            <mesh position={[0, 0, 0.02]}>
              <torusGeometry args={[0.32, 0.025, 12, 64]} />
              <meshStandardMaterial color={tier.bands[0].c} emissive={tier.bands[0].e} emissiveIntensity={1.0} metalness={0.9} roughness={0.10} />
            </mesh>

            {/* Numeral */}
            <Text position={[-0.04, 0, 0.035]} fontSize={0.40} color={tier.textColor} anchorX="center" anchorY="middle"
              // @ts-ignore
              fontWeight={800}>{rank}</Text>
            {/* Suffix */}
            <Text position={[0.20, 0.05, 0.035]} fontSize={0.14} color={tier.textColor} anchorX="center" anchorY="middle"
              // @ts-ignore
              fontWeight={800}>{rank === 1 ? 'ST' : rank === 2 ? 'ND' : 'RD'}</Text>
          </group>
        </group>
      )}

      {/* ── Invisible hover plane ── */}
      <mesh position={[0,0,GF+0.18]}
        onPointerOver={() => { hoveredRef.current=true; document.body.style.cursor="pointer"; }}
        onPointerOut={() =>  { hoveredRef.current=false; cursorRef.current={x:0,y:0}; document.body.style.cursor="default"; }}
        onPointerMove={(e) => {
          if (!groupRef.current) return;
          const local = groupRef.current.worldToLocal(e.point.clone());
          cursorRef.current = {
            x: THREE.MathUtils.clamp(local.x/(WW/2),-1,1),
            y: THREE.MathUtils.clamp(local.y/(HW/2),-1,1),
          };
        }}>
        <planeGeometry args={[WW,HW]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
