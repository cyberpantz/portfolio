import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute } from 'three';
import { GrassField } from './GrassField';

function DebrisParticles() {
  const pointsRef = useRef<any>(null);
  const count = 300;

  const { positions, speedsX, speedsY, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speedsX   = new Float32Array(count);
    const speedsY   = new Float32Array(count);
    const phases    = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 12 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      speedsX[i] = 0.02 + Math.random() * 0.03;
      speedsY[i] = (Math.random() - 0.5) * 0.005;
      phases[i]  = Math.random() * Math.PI * 2;
    }
    return { positions, speedsX, speedsY, phases };
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
      pos[i * 3]     += speedsX[i] + Math.sin(t * 0.8 + phases[i]) * 0.008;
      pos[i * 3 + 1] += speedsY[i] + Math.sin(t * 1.1 + phases[i] * 1.4) * 0.004;
      pos[i * 3 + 2] += Math.cos(t * 0.5 + phases[i]) * 0.006;
      if (pos[i * 3] > 30) pos[i * 3] = -30;
      if (pos[i * 3 + 1] < -4) pos[i * 3 + 1] = 10;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color="#888880" size={0.1} transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

export default function Overcast() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.06) * 1.5;
    camera.position.z = -t * 0.45;
    camera.position.y = 1.2 + Math.sin(t * 0.35) * 0.25;
    camera.rotation.z = Math.sin(t * 0.05) * 0.012;
  });

  return (
    <>
      <ambientLight intensity={0.6} color="#9A9E9C" />
      <fog attach="fog" args={['#828282', 5, 45]} />

      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#8A8A8A" side={2} />
      </mesh>

      {/* Wet mud base — grass blades sit on top */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#2B2619" />
      </mesh>

      <GrassField
        count={50000}
        spreadX={80}
        spreadZ={200}
        groundY={0}
        maxBladeH={0.50}
        windStrength={1.5}
        colorBase={[0.10, 0.16, 0.08]}
        colorTip={[0.30, 0.40, 0.18]}
      />

      <DebrisParticles />
    </>
  );
}
