import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import {
  ShaderMaterial, DataTexture, RGBAFormat, UnsignedByteType,
  AdditiveBlending, BufferGeometry, BufferAttribute,
} from 'three';
import { weatherAudio } from '../audio';
// @ts-ignore
import glassFrag from '../shaders/wetGlass.frag.glsl?raw';
// @ts-ignore
import glassVert from '../shaders/wetGlass.vert.glsl?raw';

const MASK_SIZE = 512;

export default function Storm() {
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

  // Lightning state
  const lightning = useRef({ nextIn: 15 + Math.random() * 15 });

  // Rain particles
  const pointsRef = useRef<any>(null);
  const count = 5000;
  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 60 - 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      vel[i] = 0.12 + Math.random() * 0.08;
    }
    return { positions: pos, velocities: vel };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  // Condensation clearing (same as Rain)
  const clearing = useRef(false);
  const clearAt = (clientX: number, clientY: number) => {
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
  };

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
  }, []);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (glassMat.current) glassMat.current.uniforms.uTime.value = t;

    // Condensation refill — same 10s rate as Rain
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

    // Rain particles — faster than Rain
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] -= velocities[i];
        pos[i * 3]     -= velocities[i] * 0.15;
        if (pos[i * 3 + 1] < -10) {
          pos[i * 3 + 1] = 50;
          pos[i * 3]     = (Math.random() - 0.5) * 80;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Lightning — random interval 12–30s
    lightning.current.nextIn -= delta;
    if (lightning.current.nextIn <= 0) {
      lightning.current.nextIn = 12 + Math.random() * 18;
      // Brief scene brightness spike via ambient light flicker would need a ref to the light
      // Instead, trigger thunder with delay — visual flash handled by glassMat uTime spike
      const delay = 1000 + Math.random() * 2000;
      setTimeout(() => weatherAudio.thunder(), delay);
    }
  });

  return (
    <>
      <ambientLight intensity={0.05} color="#050810" />
      <fog attach="fog" args={['#0A0F1E', 15, 60]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#060810" metalness={0.9} roughness={0.1} />
      </mesh>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#6688BB"
          size={0.06}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
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
