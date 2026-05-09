import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds, Sky } from '@react-three/drei';
import { ShaderMaterial } from 'three';
// @ts-ignore
import grassWaveVert from '../shaders/grassWave.vert.glsl?raw';
// @ts-ignore
import grassCloudyFrag from '../shaders/grassCloudy.frag.glsl?raw';

export default function PartlyCloudy() {
  const groundRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime:         { value: 0 },
    uWindStrength: { value: 1.0 },
  }), []);

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    if (groundRef.current) groundRef.current.uniforms.uTime.value = t;
    camera.position.x = Math.sin(t * 0.04) * 3;
    camera.position.y = 0.5 + Math.sin(t * 0.06) * 0.7;
    camera.rotation.x = 0.3 + Math.sin(t * 0.02) * 0.06;
    camera.rotation.z = Math.sin(t * 0.03) * 0.01;
  });

  return (
    <>
      <Sky sunPosition={[100, 40, -100]} turbidity={4} rayleigh={1} />
      <ambientLight intensity={0.7} color="#B8CCE0" />
      <directionalLight position={[50, 80, -50]} intensity={0.8} color="#FFF5E0" />
      <Clouds>
        <Cloud position={[-20, 25, -60]} speed={0.25} opacity={0.7} segments={12} />
        <Cloud position={[30, 30, -80]} speed={0.18} opacity={0.5} segments={10} />
        <Cloud position={[10, 20, -40]} speed={0.30} opacity={0.4} segments={8} />
        <Cloud position={[-40, 18, -50]} speed={0.20} opacity={0.3} segments={7} />
      </Clouds>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
        <planeGeometry args={[200, 200, 80, 80]} />
        <shaderMaterial
          ref={groundRef}
          vertexShader={grassWaveVert}
          fragmentShader={grassCloudyFrag}
          uniforms={uniforms}
        />
      </mesh>
      <fog attach="fog" args={['#B0C4D8', 60, 200]} />
    </>
  );
}
