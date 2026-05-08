import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
// @ts-ignore
import atmFrag from '../shaders/atmosphere.frag.glsl?raw';
// @ts-ignore
import atmVert from '../shaders/atmosphere.vert.glsl?raw';

export default function ClearDay() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.rotation.x = Math.sin(t * 0.011) * 0.4 - 0.1;
    camera.rotation.y += 0.00015;
  });

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[500, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={atmVert}
        fragmentShader={atmFrag}
        uniforms={uniforms}
        side={2}
      />
    </mesh>
  );
}
