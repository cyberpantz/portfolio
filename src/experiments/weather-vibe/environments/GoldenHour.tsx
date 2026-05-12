import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import { GrassField } from './GrassField';

// ── Sky shader ────────────────────────────────────────────────────────────────
// Uses world-space direction (same approach as atmosphere.vert/frag) so the
// gradient is always sky-relative, not sphere-UV-relative.
const SKY_VERT = `
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  uniform float uTime;
  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float elev = dir.y;

    // Color stops
    vec3 ground  = vec3(0.10, 0.05, 0.01);             // dark warm earth (below horizon)
    vec3 horizon = vec3(1.00, 0.60, 0.12);             // bright amber-orange at horizon
    vec3 midSky  = vec3(0.72, 0.22, 0.38);             // deep crimson/magenta mid-sky
    vec3 zenith  = vec3(0.08, 0.13, 0.46);             // indigo blue at zenith

    vec3 sky = mix(ground,  horizon, smoothstep(-0.06, 0.01, elev));
    sky = mix(sky, midSky,  smoothstep(0.01,  0.28,  elev));
    sky = mix(sky, zenith,  smoothstep(0.28,  0.92,  elev));

    // Sun — low on the horizon, straight ahead (-Z axis)
    vec3 sunDir   = normalize(vec3(0.0, -0.12, -1.0));
    float sunDot  = dot(dir, sunDir);
    float sunDisc = smoothstep(0.9940, 0.9975, sunDot);
    float glow1   = smoothstep(0.920,  0.9940, sunDot) * 0.28;
    float glow2   = smoothstep(0.700,  0.920,  sunDot) * 0.10;

    sky += vec3(1.00, 0.96, 0.72) * sunDisc;
    sky += vec3(1.00, 0.68, 0.22) * glow1;
    sky += vec3(0.90, 0.42, 0.08) * glow2;

    // Faint shimmer in the horizon band
    float shimmer = sin(uTime * 0.18 + dir.x * 4.0 + dir.z * 2.5) * 0.006;
    sky = clamp(sky + shimmer, 0.0, 1.0);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export default function GoldenHour({ noGrass = false }: { noGrass?: boolean }) {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.04) * 1.6;
    camera.position.y = 1.4 + Math.sin(t * 0.09) * 0.35;
    camera.rotation.x = Math.sin(t * 0.012) * 0.08 - 0.06; // gaze toward horizon
    camera.rotation.z = Math.sin(t * 0.035) * 0.008;
  });

  return (
    <>
      {/* Gradient sky sphere */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={SKY_VERT}
          fragmentShader={SKY_FRAG}
          uniforms={uniforms}
          side={2}
        />
      </mesh>

      {/* Warm fill lighting */}
      <ambientLight intensity={0.9} color="#FF9040" />
      <directionalLight position={[30, 8, -200]} intensity={1.8} color="#FFB830" />

      {/* Warm atmospheric haze near horizon */}
      <fog attach="fog" args={['#D06018', 40, 280]} />

      {/* Dark warm earth base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial color="#1A0D04" />
      </mesh>

      {/* Amber-tipped grass, warmer than clear-day */}
      {!noGrass && (
        <GrassField
          count={90000}
          spreadX={90}
          spreadZ={220}
          groundY={0}
          maxBladeH={0.55}
          windStrength={0.7}
          colorBase={[0.32, 0.20, 0.04]}
          colorTip={[0.72, 0.52, 0.10]}
        />
      )}
    </>
  );
}
