import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';
import type { Group, Points } from 'three';
// @ts-ignore — glsl imports handled by vite
import starFrag from '../shaders/starField.frag.glsl?raw';
// @ts-ignore
import starVert from '../shaders/starField.vert.glsl?raw';

function StarSphere() {
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
    <group position={[80, 60, -200]}>
      <mesh>
        <sphereGeometry args={[8, 32, 32]} />
        <meshStandardMaterial color="#E8E0D0" emissive="#C8C0A0" emissiveIntensity={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[12, 32, 32]} />
        <meshStandardMaterial color="#8080A0" transparent opacity={0.06} />
      </mesh>
      <pointLight color="#C8D0F0" intensity={0.8} distance={400} />
    </group>
  );
}

function Fireflies() {
  const pointsRef = useRef<Points>(null);
  const count = 80;

  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 3 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      phases[i] = Math.random() * Math.PI * 2;
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
    const t = clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += Math.sin(t * 0.3 + phases[i]) * 0.003;
      pos[i * 3 + 2] += Math.cos(t * 0.2 + phases[i]) * 0.003;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    (pointsRef.current.material as any).opacity =
      0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + 1.2));
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#AAFFAA"
        size={0.15}
        transparent
        opacity={0.6}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function ClearNight() {
  const groupRef = useRef<Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0026;
    const t = state.clock.getElapsedTime();
    state.camera.position.x = Math.sin(t * 0.05) * 1.4;
    state.camera.position.y = Math.sin(t * 0.08) * 0.6;
    state.camera.rotation.z = Math.sin(t * 0.04) * 0.008;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.04} color="#1A1A3E" />
      <StarSphere />
      <Moon />
      <Fireflies />
    </group>
  );
}
