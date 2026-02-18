"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function WaveMesh() {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, uniforms } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(14, 6, 128, 64);

    const u = {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0.15, 0.15, 0.15) },
      uColor2: { value: new THREE.Color(0.35, 0.35, 0.35) },
      uOpacity: { value: 0.4 },
    };

    return { geometry: geo, uniforms: u };
  }, []);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime * 0.4;
  });

  const vertexShader = `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;

      vec3 pos = position;

      // Primary wave
      float wave1 = sin(pos.x * 0.8 + uTime * 1.2) * 0.3;
      wave1 += sin(pos.x * 0.4 + uTime * 0.8) * 0.5;

      // Secondary wave
      float wave2 = sin(pos.y * 1.2 + uTime * 0.6) * 0.15;
      wave2 += cos(pos.x * 0.6 + pos.y * 0.8 + uTime * 0.5) * 0.2;

      // Tertiary subtle detail
      float wave3 = sin(pos.x * 2.0 + pos.y * 1.5 + uTime * 1.5) * 0.05;

      pos.z = wave1 + wave2 + wave3;
      vElevation = pos.z;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uOpacity;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float mixFactor = (vElevation + 0.5) * 0.8;
      mixFactor = clamp(mixFactor, 0.0, 1.0);

      vec3 color = mix(uColor1, uColor2, mixFactor);

      // Fade edges
      float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
      edgeFade *= smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);

      gl_FragColor = vec4(color, uOpacity * edgeFade);
    }
  `;

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-0.5, 0, 0]} position={[0, -0.5, 0]}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function WaveBackground() {
  return (
    <div className="wave-bg-container">
      <Canvas
        camera={{ position: [0, 2, 5], fov: 50 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <WaveMesh />
      </Canvas>
    </div>
  );
}
