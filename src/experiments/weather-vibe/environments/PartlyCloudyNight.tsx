import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds } from '@react-three/drei';
import { GrassField } from './GrassField';
import { ShaderMaterial, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';
import type { Points } from 'three';
// @ts-ignore
import starFrag from '../shaders/starField.frag.glsl?raw';
// @ts-ignore
import starVert from '../shaders/starField.vert.glsl?raw';
import { useMemo } from 'react';

function StarField() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
  });
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={starVert}
        fragmentShader={starFrag}
        uniforms={uniforms}
        side={2}
      />
    </mesh>
  );
}

function Moon() {
  return (
    <group position={[60, 55, -180]}>
      <mesh>
        <sphereGeometry args={[7, 32, 32]} />
        <meshStandardMaterial color="#D8D0C0" emissive="#B0A888" emissiveIntensity={0.35} />
      </mesh>
      <mesh>
        <sphereGeometry args={[11, 32, 32]} />
        <meshStandardMaterial color="#6070A0" transparent opacity={0.05} />
      </mesh>
      <pointLight color="#B8C0E0" intensity={0.6} distance={400} />
    </group>
  );
}

function Fireflies() {
  const pointsRef = useRef<Points>(null);
  const count = 40;
  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = Math.random() * 3 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
      phases[i]             = Math.random() * Math.PI * 2;
    }
    return { positions, phases };
  }, []);
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    return geo;
  }, [positions]);
  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t   = clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += Math.sin(t * 0.3 + phases[i]) * 0.003;
      pos[i * 3 + 2] += Math.cos(t * 0.2 + phases[i]) * 0.003;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    (pointsRef.current.material as any).opacity = 0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + 1.2));
  });
  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color="#AAFFAA" size={0.12} transparent opacity={0.4}
        blending={AdditiveBlending} depthWrite={false} />
    </points>
  );
}

export default function PartlyCloudyNight({ noGrass = false }: { noGrass?: boolean }) {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.04) * 2.5;
    camera.position.y = 0.3 + Math.sin(t * 0.06) * 0.5;
    camera.rotation.x = -0.05 + Math.sin(t * 0.02) * 0.04;
    camera.rotation.z = Math.sin(t * 0.03) * 0.008;
  });

  return (
    <>
      <ambientLight intensity={0.04} color="#0A1030" />
      <StarField />
      <Moon />
      <Fireflies />

      {/* Dark clouds drifting across the star field */}
      <Clouds>
        <Cloud position={[-15, 28, -80]} speed={0.20} opacity={0.55} color="#1A1E2A" segments={10} />
        <Cloud position={[ 25, 32, -110]} speed={0.14} opacity={0.45} color="#161A26" segments={9} />
        <Cloud position={[  5, 24, -60]}  speed={0.28} opacity={0.40} color="#1C2030" segments={8} />
        <Cloud position={[-35, 20, -90]}  speed={0.18} opacity={0.35} color="#181C28" segments={7} />
      </Clouds>

      <fog attach="fog" args={['#080A14', 80, 300]} />

      {!noGrass && (
        <GrassField
          count={70000}
          spreadX={80}
          spreadZ={200}
          groundY={-5}
          maxBladeH={0.45}
          windStrength={0.9}
          colorBase={[0.02, 0.04, 0.04]}
          colorTip={[0.04, 0.09, 0.08]}
        />
      )}
    </>
  );
}
