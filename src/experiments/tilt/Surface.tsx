/**
 * Chapter three in three dimensions.
 *
 * ── Why this chapter and no other ────────────────────────────────────────
 *
 * The finding is not "rates went up". It is that a relationship which barely
 * existed in 2002 — between how small a county is and how much it jails —
 * had become strong by 2019. That is a property of a SURFACE: county size on
 * one axis, year on the other, rate as height.
 *
 * Seen whole, the near edge (2002) is almost level and the far edge (2019) is
 * a ramp, and the object between them twists. A line chart can show the same
 * numbers but makes the reader assemble the twist from seven separate slopes.
 * Here it is one shape, and you can walk around it.
 *
 * Every other chapter is deliberately flat. This is the only place the third
 * dimension is carrying information rather than decorating two.
 *
 * ── What it refuses to do ────────────────────────────────────────────────
 *
 * No auto-rotation. A surface that spins on its own is a screensaver, and it
 * moves while you are trying to read a value off it. The camera only moves
 * when the reader moves it, and the orbit is clamped so the thing cannot be
 * turned upside down or edge-on into invisibility.
 *
 * Falls back to the 2D chart whenever WebGL is unavailable or reduced motion
 * is set — the caller handles that, because the fallback is a real chart and
 * not this component's business.
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export type SurfaceData = {
  /** One entry per size band, smallest first. */
  bands: { label: string; rate: number[] }[];
  years: number[];
};

/* Matches the 2D ramp so a reader moving between them is not relearning. */
const RAMP = ['#e8734a', '#e08a4e', '#c9975c', '#9c9a6e', '#6d9a8c', '#4f8fa8', '#4a7ab8'];

const SX = 3.2;   // width across the size axis
const SZ = 4.4;   // depth across the years
const SY = 2.6;   // height

function Mesh({ data }: { data: SurfaceData }) {
  const { geometry, wire } = useMemo(() => {
    const nx = data.bands.length, nz = data.years.length;
    const all = data.bands.flatMap((b) => b.rate);
    const lo = Math.min(...all), hi = Math.max(...all);

    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const c = new THREE.Color();
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        const v = data.bands[x].rate[z];
        pos.push(
          (x / (nx - 1) - 0.5) * SX,
          ((v - lo) / (hi - lo)) * SY,
          (z / (nz - 1) - 0.5) * SZ
        );
        /* Colour by BAND, not by height. Height already encodes the rate;
           colouring by it again would say one thing twice and leave the size
           axis unlabelled from every angle. */
        c.set(RAMP[x % RAMP.length]);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let z = 0; z < nz - 1; z++) {
      for (let x = 0; x < nx - 1; x++) {
        const a = z * nx + x, b = a + 1, d = a + nx, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { geometry: g, wire: new THREE.WireframeGeometry(g) };
  }, [data]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* The wireframe is not decoration: on a smooth surface with no gridlines
          there is nothing to judge the slope against, and the tilt stops being
          legible as soon as the camera moves off axis. */}
      <lineSegments geometry={wire}>
        <lineBasicMaterial color="#e8e8e0" transparent opacity={0.16} />
      </lineSegments>
    </group>
  );
}

/** A faint floor so the surface has something to be tilted relative to. */
function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[SX * 1.35, SZ * 1.2]} />
      <meshBasicMaterial color="#e8e8e0" transparent opacity={0.04} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* A very slow drift on first load only, so the shape reads as an object
   rather than a picture — then it stops and stays where the reader leaves it. */
function Settle({ done }: { done: React.MutableRefObject<boolean> }) {
  const t = useRef(0);
  useFrame((state, dt) => {
    if (done.current) return;
    t.current += dt;
    if (t.current > 2.2) { done.current = true; return; }
    state.camera.position.x = Math.sin(t.current * 0.35) * 0.6 + 4.6;
    state.camera.lookAt(0, 0.7, 0);
  });
  return null;
}

export default function Surface({ data }: { data: SurfaceData }) {
  const settled = useRef(false);
  return (
    <Canvas
      camera={{ position: [4.6, 3.1, 5.0], fov: 38 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', display: 'block' }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 8, 6]} intensity={1.15} />
      <directionalLight position={[-6, 3, -4]} intensity={0.35} />
      <Floor />
      <Mesh data={data} />
      <Settle done={settled} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={4.5}
        maxDistance={11}
        /* Clamped so the surface cannot be turned edge-on or viewed from
           underneath, both of which make it unreadable and look broken. */
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.35}
        onStart={() => { settled.current = true; }}
      />
    </Canvas>
  );
}
