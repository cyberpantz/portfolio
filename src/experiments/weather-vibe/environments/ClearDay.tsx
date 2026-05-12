import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';
// @ts-ignore
import atmFrag from '../shaders/atmosphere.frag.glsl?raw';
// @ts-ignore
import atmVert from '../shaders/atmosphere.vert.glsl?raw';
import { GrassField } from './GrassField';

function DustMotes() {
  const pointsRef = useRef<any>(null);
  const count = 250;

  const { positions, speeds, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 10 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      speeds[i]  = 0.004 + Math.random() * 0.004;
      phases[i]  = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, phases };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += speeds[i] + Math.sin(t * 0.4 + phases[i]) * 0.004;
      pos[i * 3 + 1] += Math.sin(t * 0.6 + phases[i] * 1.3) * 0.003;
      pos[i * 3 + 2] += Math.cos(t * 0.3 + phases[i]) * 0.003;
      if (pos[i * 3] > 20) pos[i * 3] = -20;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#FFE880"
        size={0.07}
        transparent
        opacity={0.35}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function ClearDay({ noGrass = false }: { noGrass?: boolean }) {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.07) * 1.8;
    camera.position.y = 1.8 + Math.sin(t * 0.13) * 0.4;
    camera.rotation.x = Math.sin(t * 0.011) * 0.12 - 0.04; // gentler, more horizon
    camera.rotation.y += 0.00015;
  });

  return (
    <>
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={atmVert}
          fragmentShader={atmFrag}
          uniforms={uniforms}
          side={2}
        />
      </mesh>

      {/* Warm daylight fill so buildings and any opaque objects are lit */}
      <ambientLight intensity={1.4} color="#FFF4E0" />

      {/* Golden dry-grass field — warm California afternoon */}
      {!noGrass && (
        <GrassField
          count={90000}
          spreadX={90}
          spreadZ={220}
          groundY={0}
          maxBladeH={0.50}
          windStrength={1.1}
          colorBase={[0.28, 0.22, 0.06]}
          colorTip={[0.52, 0.42, 0.12]}
        />
      )}

      <DustMotes />
    </>
  );
}
