import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, ShapeGeometry, ShaderMaterial, DoubleSide } from 'three';
import type { Palette, WeatherState } from '../conditions';
import { ShoreWaves } from './ShoreWaves';

function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ── Ocean water shader (Gerstner waves) ──────────────────────────────────────
// Plane local axes: X = world X, Y = world -Z (depth), Z = world +Y (up).
// Gerstner displaces X/Y horizontally and Z vertically for peaked crests.
const WATER_VERT = `
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
    vec2 xz0  = pos.xy;  // undisplaced coords for phase

    // Long Caribbean swell + secondary cross-chop + short ripple
    gerstner(normalize(vec2( 1.0,  0.7)), 0.449, 0.18, 0.55, 0.404, xz0, pos, N);
    gerstner(normalize(vec2(-0.5,  1.0)), 0.785, 0.10, 0.40, 0.942, xz0, pos, N);
    gerstner(normalize(vec2( 0.9, -0.2)), 1.257, 0.06, 0.30, 1.885, xz0, pos, N);

    vWave     = clamp((pos.z + 0.38) / 0.76, 0.0, 1.0);
    vNormal   = normalize(mat3(modelMatrix) * normalize(N));
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const WATER_FRAG = `
  uniform float time;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 deep     = vec3(0.03, 0.14, 0.30);
    vec3 mid      = vec3(0.05, 0.36, 0.52);
    vec3 shallow  = vec3(0.18, 0.70, 0.78);
    vec3 crestSSS = vec3(0.08, 0.72, 0.62);  // translucent teal at crests
    vec3 foam     = vec3(0.88, 0.96, 1.00);

    float d = vUv.y;
    vec3 color = mix(mix(shallow, mid, d * d), deep, d * d * d);

    // SSS: crest vertices lighten toward translucent teal
    float crestAmt = smoothstep(0.52, 0.82, vWave);
    color = mix(color, crestSSS, crestAmt * 0.45);

    // Shimmer detail
    float shimmer = sin(vUv.x * 22.0 + time * 2.2) * sin(vUv.y * 14.0 - time * 1.9) * 0.5 + 0.5;
    color += shimmer * 0.030 * (1.0 - d * 0.8);

    // Blinn-Phong specular (world space, bright tropical sun)
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(0.4, 1.8, -0.6));
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 80.0);
    color += vec3(1.0, 0.97, 0.88) * spec * 0.85;

    // Foam at crests
    float foamAmt = step(0.72, vWave) * (0.55 + 0.45 * sin(vUv.x * 20.0 + time * 3.5));
    color = mix(color, foam, foamAmt * 0.55);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Ocean plane: world z = -12 (near beach) to z = -400 (horizon).
// Rotation [-PI/2, 0, 0] maps plane's local +Y → world -Z,
// so center z=-206, height=388 gives near edge z=-12, far edge z=-400.
function Ocean({ groundY }: { groundY: number }) {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
  }), []);

  useFrame(({ clock }) => {
    material.uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <mesh position={[0, groundY - 0.35, -206]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[400, 388, 64, 32]} />
    </mesh>
  );
}

// ── Sandy beach ───────────────────────────────────────────────────────────────
// Plane extends from z=+4 (at camera) to z=-20, covering the foreground.
function Beach({ groundY }: { groundY: number }) {
  return (
    <mesh position={[0, groundY + 0.02, -8]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[300, 24]} />
      <meshBasicMaterial color="#D4B87A" />
    </mesh>
  );
}

// ── Palm frond silhouette (shared singleton) ──────────────────────────────────
const FROND_GEOM: ShapeGeometry = (() => {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo( 0.14, 0.28,  0.20, 0.85,  0.09, 1.90);
  shape.bezierCurveTo( 0,    1.70, -0.10, 0.80,   0,    0);
  shape.closePath();
  return new ShapeGeometry(shape, 8);
})();

// ── Palm trunk shape ──────────────────────────────────────────────────────────
function makePalmTrunkGeom(height: number, lean: number): ShapeGeometry {
  const bw = 0.10;
  const tw = 0.055;
  const shape = new Shape();
  shape.moveTo(-bw, 0);
  shape.bezierCurveTo(-tw * 0.4, height * 0.35, lean * 0.5 - tw, height * 0.72, lean - tw, height);
  shape.lineTo(lean + tw, height);
  shape.bezierCurveTo(lean * 0.5 + tw, height * 0.72, tw * 0.4, height * 0.35, bw, 0);
  shape.closePath();
  return new ShapeGeometry(shape, 12);
}

// ── Palm tree (cross-billboard trunk + radial fronds) ─────────────────────────
const FROND_COUNT  = 7;
const FROND_TILT   = Math.PI * 0.55; // ~99°: fronds droop slightly below horizontal
const FROND_COLOR  = '#1E5C25';
const TRUNK_COLOR  = '#5C4020';

interface PalmTreeProps { x: number; z: number; groundY: number; height: number; lean: number; }

function PalmTree({ x, z, groundY, height, lean }: PalmTreeProps) {
  const trunkGeom = useMemo(() => makePalmTrunkGeom(height, lean), [height, lean]);
  const crownY = groundY + height;

  return (
    <group position={[x, 0, z]}>
      {/* Cross-billboard trunk */}
      <mesh geometry={trunkGeom} position={[0, groundY, 0]}>
        <meshBasicMaterial color={TRUNK_COLOR} side={DoubleSide} />
      </mesh>
      <mesh geometry={trunkGeom} position={[0, groundY, 0]} rotation={[0, Math.PI / 2, 0]}>
        <meshBasicMaterial color={TRUNK_COLOR} side={DoubleSide} />
      </mesh>

      {/* Fronds radiating from crown */}
      {Array.from({ length: FROND_COUNT }, (_, i) => (
        <group key={i} position={[lean, crownY, 0]} rotation={[0, (i / FROND_COUNT) * Math.PI * 2, 0]}>
          <mesh geometry={FROND_GEOM} rotation={[FROND_TILT, 0, 0]}>
            <meshBasicMaterial color={FROND_COLOR} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Palm grove ────────────────────────────────────────────────────────────────
function PalmGrove({ groundY }: { groundY: number }) {
  const trees = useMemo(() => {
    const rng = makeRng(54321);
    return Array.from({ length: 18 }, () => ({
      x:      (rng() - 0.5) * 90,
      z:      -(7 + rng() * 25),
      height: 3.5 + rng() * 2.5,
      lean:   (rng() - 0.45) * 1.2,
    }));
  }, []);

  return (
    <>
      {trees.map((t, i) => (
        <PalmTree key={i} {...t} groundY={groundY} />
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

export default function TropicalBackground({ palette: _palette, groundY, weatherState: _weatherState }: Props) {
  return (
    <>
      <Ocean groundY={groundY} />
      <Beach groundY={groundY} />
      <ShoreWaves
        groundY={groundY}
        waveColor="#60B0D0"
        foamColor="#D8F0FF"
        shoreZ={-38}
        originZ={-90}
      />
      <PalmGrove groundY={groundY} />
    </>
  );
}
