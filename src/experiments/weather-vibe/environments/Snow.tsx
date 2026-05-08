import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute } from 'three';

export default function Snow() {
  const pointsRef = useRef<any>(null);
  const count = 5000;

  const { positions, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      speeds[i] = 0.012 + Math.random() * 0.016;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, offsets };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(({ clock, camera }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= speeds[i];
      pos[i * 3]     += Math.sin(t * 0.3 + offsets[i]) * 0.005;
      if (pos[i * 3 + 1] < -2) {
        pos[i * 3 + 1] = 38;
        pos[i * 3]     = camera.position.x + (Math.random() - 0.5) * 60;
        pos[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * 60;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    camera.position.z -= 0.008;
    camera.rotation.x = -0.08;
  });

  return (
    <group>
      <ambientLight intensity={0.9} color="#E8EEF4" />
      <fog attach="fog" args={['#E8EEF4', 20, 60]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#D8E4EF" />
      </mesh>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#FFFFFF"
          size={0.08}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
