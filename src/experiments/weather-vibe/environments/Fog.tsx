import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
// @ts-ignore
import fogFrag from '../shaders/fogMarch.frag.glsl?raw';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function TreeSilhouette({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, -2, z]} scale={[scale, scale, scale]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[0.3, 6, 0.3]} />
        <meshStandardMaterial color="#1A1F18" />
      </mesh>
      {[3, 5, 7].map((h, i) => (
        <mesh key={i} position={[0, h, 0]}>
          <coneGeometry args={[1.5 - i * 0.3, 2, 6]} />
          <meshStandardMaterial color="#151A14" />
        </mesh>
      ))}
    </group>
  );
}

export default function Fog() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.position.z = -t * 0.3;
    camera.position.y = 0.8 + Math.sin(t * 1.2) * 0.012;
  });

  const trees = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      x: (Math.sin(i * 2.3) * 0.5 + 0.5) * 30 - 15,
      z: -10 - i * 8,
      scale: 0.7 + (i % 3) * 0.2,
    })), []);

  return (
    <group>
      <ambientLight intensity={0.3} color="#C8CCBE" />
      <fog attach="fog" args={['#C8CCBE', 5, 40]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#A8AA9A" />
      </mesh>

      {trees.map((t, i) => <TreeSilhouette key={i} {...t} />)}

      <mesh position={[0, 0, -0.4]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={fogFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
