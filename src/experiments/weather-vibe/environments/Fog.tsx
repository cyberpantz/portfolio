import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { GrassField } from './GrassField';
// @ts-ignore
import fogFrag from '../shaders/fogMarch.frag.glsl?raw';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  // Screen-space quad: renders fullscreen regardless of camera position
  gl_Position = vec4(position.xy, 0.0, 1.0);
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

export default function Fog({ noGrass = false }: { noGrass?: boolean }) {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.09) * 1.0;
    camera.position.z = -t * 0.35;
    camera.position.y = 0.8 + Math.sin(t * 0.5) * 0.18 + Math.sin(t * 1.2) * 0.06;
    camera.rotation.z = Math.sin(t * 0.07) * 0.008;
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

      {!noGrass && (
        <GrassField
          count={80000}
          spreadX={80}
          spreadZ={200}
          groundY={-2}
          maxBladeH={0.45}
          windStrength={0.4}
          colorBase={[0.08, 0.13, 0.07]}
          colorTip={[0.18, 0.26, 0.13]}
        />
      )}

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
          depthTest={false}
        />
      </mesh>
    </group>
  );
}
