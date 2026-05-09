import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
// @ts-ignore
import fogNightFrag from '../shaders/fogMarchNight.frag.glsl?raw';

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
        <meshStandardMaterial color="#060810" />
      </mesh>
      {[3, 5, 7].map((h, i) => (
        <mesh key={i} position={[0, h, 0]}>
          <coneGeometry args={[1.5 - i * 0.3, 2, 6]} />
          <meshStandardMaterial color="#050608" />
        </mesh>
      ))}
    </group>
  );
}

export default function FogNight() {
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
    Array.from({ length: 14 }, (_, i) => ({
      x: (Math.sin(i * 2.3) * 0.5 + 0.5) * 36 - 18,
      z: -8 - i * 7,
      scale: 0.7 + (i % 3) * 0.2,
    })), []);

  return (
    <group>
      {/* Sky hemisphere: cold blue above, warm amber below (city light bounce) */}
      <hemisphereLight args={['#0A1525', '#2A1A08', 0.55]} />
      <ambientLight intensity={0.06} color="#0C1020" />

      {/* Distant streetlights — warm sodium colour bleeding through fog */}
      <pointLight position={[-7,  0.5, -22]} color="#C87820" intensity={1.2} distance={30} decay={2} />
      <pointLight position={[ 11, 0.5, -45]} color="#D08828" intensity={0.9} distance={25} decay={2} />
      <pointLight position={[ -2, 0.5, -68]} color="#B87010" intensity={0.7} distance={22} decay={2} />

      {/* Tight dark fog — visibility drops fast */}
      <fog attach="fog" args={['#0C0E13', 3, 28]} />

      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#07090D" side={2} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#09080A" />
      </mesh>

      {trees.map((t, i) => <TreeSilhouette key={i} {...t} />)}

      {/* Animated night-fog overlay */}
      <mesh position={[0, 0, -0.4]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={fogNightFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
