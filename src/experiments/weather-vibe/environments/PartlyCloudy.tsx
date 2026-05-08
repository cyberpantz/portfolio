import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds, Sky } from '@react-three/drei';

export default function PartlyCloudy() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.04) * 2;
    camera.rotation.x = 0.3 + Math.sin(t * 0.02) * 0.05;
  });

  return (
    <>
      <Sky sunPosition={[100, 40, -100]} turbidity={4} rayleigh={1} />
      <ambientLight intensity={0.7} color="#B8CCE0" />
      <directionalLight position={[50, 80, -50]} intensity={0.8} color="#FFF5E0" />
      <Clouds>
        <Cloud position={[-20, 25, -60]} speed={0.1} opacity={0.7} segments={12} />
        <Cloud position={[30, 30, -80]} speed={0.08} opacity={0.5} segments={10} />
        <Cloud position={[10, 20, -40]} speed={0.12} opacity={0.4} segments={8} />
      </Clouds>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#7A8A6A" />
      </mesh>
      <fog attach="fog" args={['#B0C4D8', 60, 200]} />
    </>
  );
}
