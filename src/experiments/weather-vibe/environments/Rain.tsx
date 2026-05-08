import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import {
  ShaderMaterial,
  DataTexture, RGBAFormat, UnsignedByteType,
  BufferGeometry, BufferAttribute, AdditiveBlending,
} from 'three';
// @ts-ignore
import glassFrag from '../shaders/wetGlass.frag.glsl?raw';
// @ts-ignore
import glassVert from '../shaders/wetGlass.vert.glsl?raw';

const MASK_SIZE = 512;

function RainWorld() {
  const particleCount = 3000;
  const pointsRef = useRef<any>(null);

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 60 - 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i] = 0.08 + Math.random() * 0.06;
    }
    return { positions, velocities };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3 + 1] -= velocities[i];
      pos[i * 3]     -= velocities[i] * 0.1;
      if (pos[i * 3 + 1] < -10) {
        pos[i * 3 + 1] = 50;
        pos[i * 3]     = (Math.random() - 0.5) * 80;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.1} color="#1A2A3A" />
      <fog attach="fog" args={['#0D1A26', 20, 80]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0D1520" metalness={0.8} roughness={0.2} />
      </mesh>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#88AACC"
          size={0.05}
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export default function Rain() {
  const { size } = useThree();
  const worldFBO = useFBO(size.width, size.height);

  const maskData = useMemo(() => new Uint8Array(MASK_SIZE * MASK_SIZE * 4).fill(255), []);
  const maskTex = useMemo(() => {
    const tex = new DataTexture(maskData, MASK_SIZE, MASK_SIZE, RGBAFormat, UnsignedByteType);
    tex.needsUpdate = true;
    return tex;
  }, [maskData]);

  const glassMat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uWorld: { value: worldFBO.texture },
    uMask: { value: maskTex },
  }), [worldFBO, maskTex]);

  useFrame(({ clock }) => {
    if (glassMat.current) glassMat.current.uniforms.uTime.value = clock.getElapsedTime();

    let dirty = false;
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i] < 255) {
        maskData[i] = Math.min(255, maskData[i] + 0.43);
        maskData[i + 1] = maskData[i];
        maskData[i + 2] = maskData[i];
        maskData[i + 3] = 255;
        dirty = true;
      }
    }
    if (dirty) maskTex.needsUpdate = true;
  });

  const clearing = useRef(false);
  const lastInteraction = useRef(Date.now());

  const clearAt = useCallback((clientX: number, clientY: number) => {
    lastInteraction.current = Date.now();
    const u = clientX / window.innerWidth;
    const v = 1 - clientY / window.innerHeight;
    const px = Math.floor(u * MASK_SIZE);
    const py = Math.floor(v * MASK_SIZE);
    const radius = 40;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || nx >= MASK_SIZE || ny < 0 || ny >= MASK_SIZE) continue;
        const idx = (ny * MASK_SIZE + nx) * 4;
        const sigma = radius * 0.4;
        const gaussian = Math.exp(-(dist * dist) / (2 * sigma * sigma));
        maskData[idx] = Math.max(0, maskData[idx] - gaussian * 255);
        maskData[idx + 1] = maskData[idx];
        maskData[idx + 2] = maskData[idx];
        maskData[idx + 3] = 255;
      }
    }
    maskTex.needsUpdate = true;
  }, [maskData, maskTex]);

  useEffect(() => {
    const onDown  = () => { clearing.current = true; };
    const onUp    = () => { clearing.current = false; };
    const onMove  = (e: MouseEvent) => { if (clearing.current) clearAt(e.clientX, e.clientY); };
    const onTouch = (e: TouchEvent) => {
      Array.from(e.touches).forEach(t => clearAt(t.clientX, t.clientY));
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
    };
  }, [clearAt]);

  // Hint animation — single automated smear after 8s of no interaction
  const hintPlayed = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (hintPlayed.current) return;
      if (Date.now() - lastInteraction.current > 8000) {
        hintPlayed.current = true;
        let x = 80, y = window.innerHeight - 120;
        const animate = () => {
          clearAt(x, y);
          x += 2;
          y -= 1;
          if (x < 180) requestAnimationFrame(animate);
        };
        animate();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [clearAt]);

  return (
    <>
      <RainWorld />
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={glassMat}
          vertexShader={glassVert}
          fragmentShader={glassFrag}
          uniforms={uniforms}
        />
      </mesh>
    </>
  );
}
