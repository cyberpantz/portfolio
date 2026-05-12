import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
import type { Palette, WeatherState } from '../conditions';
import { GrassField } from './GrassField';
import { ShoreWaves } from './ShoreWaves';

function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ── Temperate ocean shader (Gerstner waves) ───────────────────────────────────
// Choppier, darker grey-blue — Pacific Northwest / Atlantic feel.
const COAST_VERT = `
  uniform float time;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void gerstner(vec2 d, float k, float A, float Q, float w,
                vec2 xz0, inout vec3 pos, inout vec3 N) {
    float phi = k * dot(d, xz0) - w * time;
    float c = cos(phi);
    float s = sin(phi);
    pos.x += Q * A * d.x * c;
    pos.y += Q * A * d.y * c;
    pos.z += A * s;
    N.x   -= d.x * k * A * c;
    N.y   -= d.y * k * A * c;
    N.z   -= Q   * k * A * s;
  }

  void main() {
    vUv = uv;
    vec3 pos  = position;
    vec3 N    = vec3(0.0, 0.0, 1.0);
    vec2 xz0  = pos.xy;

    // Choppier Atlantic/PNW: shorter wavelengths, higher steepness
    gerstner(normalize(vec2( 0.7,  0.9)), 0.571, 0.20, 0.65, 0.571, xz0, pos, N);
    gerstner(normalize(vec2(-0.8,  0.6)), 1.047, 0.12, 0.55, 1.361, xz0, pos, N);
    gerstner(normalize(vec2( 0.9, -0.3)), 1.795, 0.07, 0.45, 3.231, xz0, pos, N);

    vWave     = clamp((pos.z + 0.42) / 0.84, 0.0, 1.0);
    vNormal   = normalize(mat3(modelMatrix) * normalize(N));
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const COAST_FRAG = `
  uniform float time;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 deep     = vec3(0.05, 0.09, 0.16);
    vec3 mid      = vec3(0.09, 0.20, 0.32);
    vec3 shallow  = vec3(0.16, 0.34, 0.50);
    vec3 crestSSS = vec3(0.12, 0.36, 0.44);  // cold grey-green through thin crests
    vec3 foam     = vec3(0.82, 0.88, 0.92);

    float d = vUv.y;
    vec3 color = mix(mix(shallow, mid, d * d), deep, d * d * d);

    // SSS: cooler, less vivid than tropical
    float crestAmt = smoothstep(0.48, 0.78, vWave);
    color = mix(color, crestSSS, crestAmt * 0.38);

    // Shimmer
    float shimmer = sin(vUv.x * 18.0 + time * 1.7) * sin(vUv.y * 11.0 - time * 1.4) * 0.5 + 0.5;
    color += shimmer * 0.022 * (1.0 - d * 0.8);

    // Softer specular (overcast sky, diffuse light)
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.3, 1.5, -0.5));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0);
    color += vec3(0.88, 0.92, 0.96) * spec * 0.50;

    // More foam — Atlantic chop
    float foamAmt = step(0.62, vWave) * (0.65 + 0.35 * sin(vUv.x * 15.0 + time * 2.6));
    color = mix(color, foam, foamAmt * 0.65);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function CoastalOcean({ groundY }: { groundY: number }) {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: COAST_VERT,
    fragmentShader: COAST_FRAG,
  }), []);

  useFrame(({ clock }) => {
    material.uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <mesh position={[0, groundY - 0.40, -206]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[400, 388, 64, 32]} />
    </mesh>
  );
}

// ── Sandy beach ───────────────────────────────────────────────────────────────
function CoastalBeach({ groundY }: { groundY: number }) {
  return (
    <mesh position={[0, groundY + 0.02, -8]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[300, 24]} />
      <meshBasicMaterial color="#C8B888" />
    </mesh>
  );
}

// ── Rocks scattered on the beach ──────────────────────────────────────────────
function BeachRocks({ groundY }: { groundY: number }) {
  const rocks = useMemo(() => {
    const rng = makeRng(77441);
    return Array.from({ length: 10 }, () => ({
      x:  (rng() - 0.5) * 50,
      z:  -(rng() * 12 + 5),
      sx: 0.25 + rng() * 0.55,
      sy: 0.18 + rng() * 0.30,
      sz: 0.22 + rng() * 0.45,
      ry: rng() * Math.PI,
    }));
  }, []);

  return (
    <>
      {rocks.map((r, i) => (
        <mesh
          key={i}
          position={[r.x, groundY + r.sy * 0.4, r.z]}
          rotation={[0, r.ry, 0]}
          scale={[r.sx, r.sy, r.sz]}
        >
          <sphereGeometry args={[0.5, 6, 5]} />
          <meshBasicMaterial color="#3A3830" />
        </mesh>
      ))}
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
interface Props {
  palette: Palette;
  groundY: number;
  weatherState: WeatherState;
}

export default function CoastalBackground({ palette: _palette, groundY, weatherState: _weatherState }: Props) {
  return (
    <>
      <CoastalOcean groundY={groundY} />
      <CoastalBeach groundY={groundY} />
      <ShoreWaves
        groundY={groundY}
        waveColor="#5888A8"
        foamColor="#C8DCE8"
        shoreZ={-22}
        originZ={-80}
      />
      <BeachRocks groundY={groundY} />

      {/* Coastal dune grass — tall, wind-beaten, olive-straw */}
      <GrassField
        count={40000}
        spreadX={60}
        spreadZ={14}
        groundY={groundY}
        maxBladeH={0.80}
        windStrength={1.8}
        colorBase={[0.22, 0.20, 0.08]}
        colorTip={[0.50, 0.48, 0.20]}
      />
    </>
  );
}
