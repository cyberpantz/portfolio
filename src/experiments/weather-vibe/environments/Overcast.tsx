import { useFrame } from '@react-three/fiber';

export default function Overcast() {
  useFrame(({ clock, camera }) => {
    camera.position.z = -clock.getElapsedTime() * 0.3;
    camera.position.y = 1.2 + Math.sin(clock.getElapsedTime() * 0.4) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.6} color="#9A9E9C" />
      <fog attach="fog" args={['#828282', 5, 45]} />
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#8A8A8A" side={2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#7A7874" />
      </mesh>
    </>
  );
}
