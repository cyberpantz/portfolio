/**
 * Chapter three in three dimensions.
 *
 * ── Why this chapter and no other ────────────────────────────────────────
 *
 * The finding is not "rates went up". It is that a relationship which barely
 * existed in 2002 — between how small a county is and how much it jails —
 * had become strong by 2019. That is a property of a SURFACE: county size on
 * one axis, year on the other, rate as height. Seen whole, the near edge is
 * almost level and the far edge is a ramp, and the object between them twists.
 *
 * Labels live IN the scene, pinned to the ends of the axes they describe, so
 * they travel with the geometry: turn it around and "2019" is still at the
 * 2019 end. A 3D chart cannot have 2D axis labels — printed under the canvas
 * they would claim a left and a right the object no longer has.
 *
 * ── What it still refuses to do ──────────────────────────────────────────
 *
 * No auto-rotation beyond a short settle. A surface that spins by itself is
 * a screensaver, and it moves while you are trying to read a value off it.
 * Orbit is clamped so it cannot be turned edge-on or viewed from beneath,
 * both of which make it unreadable and look broken.
 */

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import s from './tilt.module.css';

export type SurfaceData = {
  /** One entry per size band, smallest first. */
  bands: { label: string; rate: number[] }[];
  years: number[];
};

/* Matches the 2D ramp exactly, so a reader moving between the two charts is
   not relearning which colour is which. */
export const RAMP = ['#e8734a', '#e08a4e', '#c9975c', '#9c9a6e', '#6d9a8c', '#4f8fa8', '#4a7ab8'];

const SX = 3.2, SZ = 4.4, SY = 2.6;

type Pick = { band: number; year: number; rate: number; pos: [number, number, number] } | null;

function Surface3D({ data, onPick, picked }:
  { data: SurfaceData; onPick: (p: Pick) => void; picked: Pick }) {
  const nx = data.bands.length, nz = data.years.length;

  const { geometry, wire, lo, hi, vertex } = useMemo(() => {
    const all = data.bands.flatMap((b) => b.rate);
    const lo = Math.min(...all), hi = Math.max(...all);
    const vertex = (x: number, z: number): [number, number, number] => ([
      (x / (nx - 1) - 0.5) * SX,
      ((data.bands[x].rate[z] - lo) / (hi - lo)) * SY,
      (z / (nz - 1) - 0.5) * SZ,
    ]);
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const c = new THREE.Color();
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        pos.push(...vertex(x, z));
        /* Colour by BAND, not by height. Height already encodes the rate;
           using it twice would leave the size axis unreadable from most
           angles, which is exactly the axis the chapter is about. */
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
    return { geometry: g, wire: new THREE.WireframeGeometry(g), lo, hi, vertex };
  }, [data, nx, nz]);

  /* The grid is regular, so the nearest vertex is arithmetic rather than a
     second raycast against 126 points. */
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const x = Math.round((e.point.x / SX + 0.5) * (nx - 1));
    const z = Math.round((e.point.z / SZ + 0.5) * (nz - 1));
    const bx = Math.min(Math.max(x, 0), nx - 1), bz = Math.min(Math.max(z, 0), nz - 1);
    onPick({ band: bx, year: bz, rate: data.bands[bx].rate[bz], pos: vertex(bx, bz) });
  };

  return (
    <group>
      <mesh geometry={geometry} onPointerMove={move} onPointerOut={() => onPick(null)}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Not decoration: on a smooth surface with no gridlines there is
          nothing to judge the slope against, and the tilt stops being legible
          as soon as the camera moves off axis. */}
      <lineSegments geometry={wire}>
        <lineBasicMaterial color="#e8e8e0" transparent opacity={0.16} />
      </lineSegments>

      {picked && (
        <group position={picked.pos}>
          <mesh>
            <sphereGeometry args={[0.055, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <Html center distanceFactor={9} zIndexRange={[20, 0]}>
            <div className={s.pick}>
              <b>{Math.round(picked.rate)}</b>
              <span>per 100k</span>
              <em>{data.bands[picked.band].label} &middot; {data.years[picked.year]}</em>
            </div>
          </Html>
        </group>
      )}

      {/* Axis labels live in the scene and travel with it. Turn the surface
          around and 2019 is still at the 2019 end. */}
      {data.bands.map((b, i) => (
        <Html key={b.label} position={[(i / (nx - 1) - 0.5) * SX, -0.12, -SZ / 2 - 0.34]}
              center zIndexRange={[10, 0]}>
          <span className={s.axisTick} style={{ color: RAMP[i] }}>{b.label}</span>
        </Html>
      ))}
      <Html position={[SX / 2 + 0.46, -0.1, -SZ / 2]} center zIndexRange={[10, 0]}>
        <span className={s.axisTick}>{data.years[0]}</span>
      </Html>
      <Html position={[SX / 2 + 0.46, -0.1, SZ / 2]} center zIndexRange={[10, 0]}>
        <span className={s.axisTick}>{data.years[data.years.length - 1]}</span>
      </Html>
      <Html position={[-SX / 2 - 0.5, SY / 2, -SZ / 2]} center zIndexRange={[10, 0]}>
        <span className={s.axisName}>jail rate &middot; {Math.round(lo)}&ndash;{Math.round(hi)} per 100k</span>
      </Html>
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[SX * 1.35, SZ * 1.2]} />
      <meshBasicMaterial color="#e8e8e0" transparent opacity={0.04} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* A brief drift on load so the shape reads as an object rather than a
   picture, then it stops and stays where the reader leaves it. */
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
  const [picked, setPicked] = useState<Pick>(null);
  return (
    <Canvas camera={{ position: [4.6, 3.1, 5.0], fov: 38 }} dpr={[1, 2]}
            style={{ width: '100%', height: '100%', display: 'block' }}
            gl={{ antialias: true }}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 8, 6]} intensity={1.15} />
      <directionalLight position={[-6, 3, -4]} intensity={0.35} />
      <Floor />
      <Surface3D data={data} onPick={setPicked} picked={picked} />
      <Settle done={settled} />
      <OrbitControls enablePan={false} enableZoom minDistance={4.5} maxDistance={11}
                     minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.35}
                     onStart={() => { settled.current = true; }} />
    </Canvas>
  );
}
