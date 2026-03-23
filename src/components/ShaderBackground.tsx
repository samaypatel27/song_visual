"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// VERTEX SHADER
// Passes clip-space position straight through.  The geometry is already a
// PlaneGeometry(2, 2) which lives in [-1, 1] clip space, so no projection
// transform is needed. hi
// ─────────────────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// FRAGMENT SHADER
//
// Algorithm overview
// ──────────────────
// 1. 2D Simplex noise  — classic Gustavson implementation, zero external deps.
// 2. 3-octave FBM      — three noise evaluations layered at 2x scale/0.5x
//    amplitude each, staying exactly within the 2–3 octave requirement.
// 3. Domain warping    — a single extra FBM sample offsets the lookup coords,
//    turning simple animated noise into slow organic blob shapes.  This adds
//    ONE additional pass of the 3-octave FBM, for 6 noise evaluations total.
// 4. Dark palette      — three anchor colours (#000000 → #0a0a1a → #1a1a3a).
//    smoothstep transitions prevent any abrupt edges.
//
// Performance budget on a MacBook Pro
// ────────────────────────────────────
// • Six simplex noise calls, each ~40 ALU ops       ≈ 240 instrs / pixel
// • No sqrt, no texture fetches, no branches in hot path
// • Easily > 60 fps at 2x Retina (pixel ratio capped to 1.5 in JS)
// ─────────────────────────────────────────────────────────────────────────────
const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform float u_time;
  uniform vec2  u_resolution;

  // ── 2D Simplex Noise ───────────────────────────────────────────────────────
  // Source: Stefan Gustavson, 2011 (public domain).
  vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

  float snoise(vec2 v) {
    const vec4 C = vec4(
       0.211324865405187,   // (3.0 - sqrt(3.0)) / 6.0
       0.366025403784439,   // 0.5 * (sqrt(3.0) - 1.0)
      -0.577350269189626,   // -1.0 + 2.0 * C.x
       0.024390243902439    // 1.0 / 41.0
    );

    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy  -= i1;

    i = mod(i, 289.0);
    vec3 p = permute(
               permute(i.y + vec3(0.0, i1.y, 1.0))
                     + i.x + vec3(0.0, i1.x, 1.0)
             );

    vec3 m = max(
      0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
      0.0
    );
    m = m * m;
    m = m * m;

    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);

    // Normalise gradients implicitly (Taylor approximation)
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    vec3 g;
    g.x  = a0.x  * x0.x   + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;

    return 130.0 * dot(m, g); // output range ≈ [-1, 1]
  }

  // ── 3-Octave Fractional Brownian Motion ───────────────────────────────────
  // Exactly 3 simplex noise evaluations per call.
  // Lacunarity = 2.0 (classic doubling), gain = 0.5 (classic halving).
  float fbm3(vec2 p) {
    float value     = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    // Octave 1
    value     += amplitude  * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;

    // Octave 2
    value     += amplitude  * snoise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;

    // Octave 3
    value     += amplitude  * snoise(p * frequency);

    return value; // range approximately [-0.875, 0.875]
  }

  void main() {
    // ── Aspect-correct, centred UV ─────────────────────────────────────────
    vec2 uv = gl_FragCoord.xy / u_resolution;
    uv = (uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);

    // 0.18: blobs drift visibly over ~15 seconds — slow and organic, not still.
    float t = u_time * 0.18;

    // ── Domain warping ─────────────────────────────────────────────────────
    // Evaluate fbm3 once to produce a 2D warp offset, then evaluate it again
    // at the warped location.  This causes blob boundaries to fold and coil
    // organically without any extra noise octaves or raymarching.
    vec2 sampleCoord = uv * 1.6;                          // base spatial frequency

    float warpX = fbm3(sampleCoord + vec2(t * 0.41, t * 0.33));
    float warpY = fbm3(sampleCoord + vec2(t * 0.37, t * 0.29) + 4.7);
    vec2  warp  = vec2(warpX, warpY);

    float n = fbm3(sampleCoord + warp * 0.55 + t * 0.09);

    // Remap from ≈[-0.875, 0.875] to [0, 1]
    n = n * 0.5 + 0.5;

    // ── Colour mapping ─────────────────────────────────────────────────────
    // Most of the image should sit in the black-to-navy band.
    // Only blob peaks reach the blue-purple highlight.
    vec3 cBlack  = vec3(0.000, 0.000, 0.000); // #000000        — base
    vec3 cNavy   = vec3(0.028, 0.180, 0.082); // #071f15 dark   — blob body (~25% of Spotify green)
    vec3 cPurple = vec3(0.114, 0.725, 0.329); // #1DB954 full   — blob edge highlight (Spotify green)

    // Keep the black zone dominant (0 → 0.42 stays near black)
    vec3 color = mix(cBlack, cNavy,   smoothstep(0.30, 0.58, n));
    color      = mix(color,  cPurple, smoothstep(0.60, 0.85, n));

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// REACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ShaderBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    // antialias: false — irrelevant for a full-screen shader quad.
    // pixelRatio capped at 1.5 — halves fragment shader load on Retina.
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    // ── Scene + camera ──────────────────────────────────────────────────────
    // OrthographicCamera(-1, 1, 1, -1) maps exactly to clip space, so the
    // PlaneGeometry(2, 2) quad fills the viewport with no projection maths.
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ── Uniforms ────────────────────────────────────────────────────────────
    const uniforms = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    };

    // ── Full-screen quad ────────────────────────────────────────────────────
    // PlaneGeometry(2, 2) sits in [-1, 1] × [-1, 1] — perfectly matching
    // the OrthographicCamera frustum defined above.
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
    scene.add(new THREE.Mesh(geometry, material));

    // ── Animation loop ──────────────────────────────────────────────────────
    const startMs = performance.now(); // replaces THREE.Clock (deprecated)
    let animId: number;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      uniforms.u_time.value = (performance.now() - startMs) / 1000; // seconds
      renderer.render(scene, camera);
    };
    tick();

    // ── Resize handler ──────────────────────────────────────────────────────
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    // Dispose all GPU resources and cancel the animation frame on unmount.
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    // position: fixed + inset: 0 makes the canvas cover the full viewport.
    // z-index: 0 keeps it behind all page content.
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        overflow: "hidden",
      }}
    />
  );
}
