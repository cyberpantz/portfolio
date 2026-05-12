import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shape, ShapeGeometry, Color, DoubleSide } from 'three';
import type { Palette, WeatherState } from '../conditions';

function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ── Mountain ridge ────────────────────────────────────────────────────────────
interface RidgeProps {
  z: number;
  color: string;
  peakHeight: number;
  width: number;
  seed: number;
  groundY: number;
}

function MountainRidge({ z, color, peakHeight, width, seed, groundY }: RidgeProps) {
  const geometry = useMemo(() => {
    const rng  = makeRng(seed);
    const p1   = rng() * Math.PI * 2;
    const p2   = rng() * Math.PI * 2;
    const p3   = rng() * Math.PI * 2;
    const segs = 120;

    const profile: [number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = (t - 0.5) * width;
      const large  = Math.pow(Math.abs(Math.sin(t * Math.PI * 2.1 + p1)), 0.55) * peakHeight;
      const medium = Math.abs(Math.sin(t * Math.PI * 5.3 + p2)) * peakHeight * 0.32;
      const fine   = Math.sin(t * Math.PI * 13.7 + p3) * peakHeight * 0.10;
      profile.push([x, groundY + Math.max(0, large + medium + fine - peakHeight * 0.08)]);
    }

    const shape = new Shape();
    shape.moveTo(-width / 2, groundY - 40);
    shape.lineTo(profile[0][0], profile[0][1]);
    for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i][0], profile[i][1]);
    shape.lineTo(width / 2, groundY - 40);
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [seed, peakHeight, width, groundY]);

  return (
    <mesh position={[0, 0, z]} geometry={geometry}>
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

// ── Pine silhouette shape ─────────────────────────────────────────────────────
function makePineShape(rng: () => number, width: number, height: number): Shape {
  const trunkH   = height * 0.14;
  const foliageH = height - trunkH;
  const jagLayers = 9;

  const leftPts:  [number, number][] = [];
  const rightPts: [number, number][] = [];

  for (let i = 0; i <= jagLayers; i++) {
    const t      = i / jagLayers;
    const y      = trunkH + t * foliageH * 0.90;
    const halfW  = (1 - t * 0.95) * width * 0.5;
    const shrink = i % 2 === 0 ? 1.0 : 0.58;
    const jitter = (rng() - 0.5) * halfW * 0.18;
    leftPts.push( [-(halfW * shrink) + jitter, y] );
    rightPts.push( [ (halfW * shrink) + jitter, y] );
  }

  const tipX = (rng() - 0.5) * width * 0.05;

  const shape = new Shape();
  shape.moveTo(leftPts[0][0], leftPts[0][1]);
  for (let i = 1; i < leftPts.length; i++) shape.lineTo(leftPts[i][0], leftPts[i][1]);
  shape.lineTo(tipX, height);
  for (let i = rightPts.length - 1; i >= 0; i--) shape.lineTo(rightPts[i][0], rightPts[i][1]);
  shape.closePath();

  return shape;
}

// ── Pine tree (cross-billboard) ───────────────────────────────────────────────
interface PineProps {
  x: number; groundY: number; z: number; height: number;
  foliageColor: string; trunkColor: string; seed: number;
}

function PineTree({ x, groundY, z, height, foliageColor, trunkColor, seed }: PineProps) {
  const foliageGeom = useMemo(() => {
    const rng = makeRng(seed);
    return new ShapeGeometry(makePineShape(rng, height * 0.58, height));
  }, [seed, height]);

  const colorStr = useMemo(() => {
    const rng = makeRng(seed + 9999);
    const c = new Color(foliageColor);
    c.offsetHSL(0, 0, (rng() - 0.5) * 0.10);
    return `#${c.getHexString()}`;
  }, [seed, foliageColor]);

  const trunkH = height * 0.14;

  return (
    <group position={[x, groundY, z]}>
      <mesh geometry={foliageGeom}>
        <meshBasicMaterial color={colorStr} side={DoubleSide} />
      </mesh>
      <mesh geometry={foliageGeom} rotation={[0, Math.PI / 2, 0]}>
        <meshBasicMaterial color={colorStr} side={DoubleSide} />
      </mesh>
      <mesh position={[0, trunkH / 2, 0]}>
        <cylinderGeometry args={[0.022 * height, 0.038 * height, trunkH, 5]} />
        <meshBasicMaterial color={trunkColor} />
      </mesh>
    </group>
  );
}

// ── Forest row ────────────────────────────────────────────────────────────────
interface RowProps {
  z: number; count: number; spread: number; groundY: number;
  avgHeight: number; seed: number;
  foliageColor: string; trunkColor: string;
}

function ForestRow({ z, count, spread, groundY, avgHeight, seed, foliageColor, trunkColor }: RowProps) {
  const trees = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: count }, (_, i) => ({
      x:      (i / (count - 1) - 0.5) * spread + (rng() - 0.5) * (spread / count) * 1.8,
      height: avgHeight * (0.72 + rng() * 0.56),
      seed:   seed * 100 + i,
    }));
  }, [seed, count, spread, avgHeight]);

  return (
    <>
      {trees.map((t, i) => (
        <PineTree key={i} x={t.x} groundY={groundY} z={z} height={t.height}
          foliageColor={foliageColor} trunkColor={trunkColor} seed={t.seed} />
      ))}
    </>
  );
}

// ── Fallen leaves ─────────────────────────────────────────────────────────────
const AUTUMN_COLORS = [
  '#D2621A', '#C43020', '#D4A820', '#B87830',
  '#E07823', '#C8902A', '#8B4513', '#CC4422',
];

// Organic leaf silhouette: pointed base (stem), rounded lobes.
function makeLeafShapeGeom(w: number, h: number): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo( w * 0.8, h * 0.1,  w,       h * 0.4, w * 0.5,  h * 0.75);
  shape.bezierCurveTo( w * 0.75, h * 0.9, w * 0.2, h,       0,        h);
  shape.bezierCurveTo(-w * 0.2,  h,       -w * 0.75, h * 0.9, -w * 0.5, h * 0.75);
  shape.bezierCurveTo(-w,        h * 0.4, -w * 0.8,  h * 0.1, 0,        0);
  shape.closePath();
  return new ShapeGeometry(shape);
}

// Three shape variants shared across all instances.
const LEAF_GEOMS = [
  makeLeafShapeGeom(0.14, 0.20),
  makeLeafShapeGeom(0.18, 0.16),
  makeLeafShapeGeom(0.11, 0.24),
];

const FALLING_COUNT = 24;

interface FallenLeavesProps { groundY: number; }

function FallenLeaves({ groundY }: FallenLeavesProps) {
  // Ground cover — static, laid flat
  const groundLeaves = useMemo(() => {
    const rng = makeRng(55555);
    return Array.from({ length: 110 }, () => ({
      x:      (rng() - 0.5) * 60,
      z:      -(rng() * 18 + 1),                   // z: -1 to -19 (in front of camera)
      rotY:   rng() * Math.PI * 2,
      tiltX:  (rng() - 0.5) * 0.28,                // slight curl / non-flat landing
      tiltZ:  (rng() - 0.5) * 0.28,
      scale:  0.55 + rng() * 0.90,
      color:  AUTUMN_COLORS[Math.floor(rng() * AUTUMN_COLORS.length)],
      geomIdx: Math.floor(rng() * 3),
    }));
  }, []);

  // Airborne leaf mutable state (updated imperatively in useFrame)
  const fallingState = useRef(
    (() => {
      const rng = makeRng(77777);
      return Array.from({ length: FALLING_COUNT }, () => ({
        x:          (rng() - 0.5) * 40,
        y:          rng() * 20 + 2,
        z:          -(rng() * 18 + 1),
        ry:         rng() * Math.PI * 2,
        speed:      0.011 + rng() * 0.010,
        driftPhase: rng() * Math.PI * 2,
        driftFreq:  0.22 + rng() * 0.38,
        spinSpeed:  (rng() - 0.5) * 0.055,
        color:      AUTUMN_COLORS[Math.floor(rng() * AUTUMN_COLORS.length)],
        geomIdx:    Math.floor(rng() * 3),
      }));
    })()
  );

  const fallingRefs = useRef<(any | null)[]>(Array(FALLING_COUNT).fill(null));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    fallingState.current.forEach((leaf, i) => {
      leaf.y  -= leaf.speed;
      leaf.x  += Math.sin(t * leaf.driftFreq + leaf.driftPhase) * 0.006;
      leaf.ry += leaf.spinSpeed;
      if (leaf.y < groundY) {
        leaf.y = 16 + Math.random() * 10;
        leaf.x = (Math.random() - 0.5) * 40;
        leaf.z = -(Math.random() * 18 + 1);
      }
      const mesh = fallingRefs.current[i];
      if (mesh) {
        mesh.position.set(leaf.x, leaf.y, leaf.z);
        mesh.rotation.x = Math.sin(t * leaf.driftFreq + leaf.driftPhase) * 0.5;
        mesh.rotation.y = leaf.ry;
        mesh.rotation.z = Math.cos(t * leaf.driftFreq * 0.75 + leaf.driftPhase) * 0.22;
      }
    });
  });

  return (
    <>
      {/* Settled leaves on the ground */}
      {groundLeaves.map((leaf, i) => (
        <mesh
          key={`gl-${i}`}
          position={[leaf.x, groundY + 0.02, leaf.z]}
          rotation={[-Math.PI / 2 + leaf.tiltX, leaf.rotY, leaf.tiltZ]}
          scale={leaf.scale}
          geometry={LEAF_GEOMS[leaf.geomIdx]}
        >
          <meshBasicMaterial color={leaf.color} side={DoubleSide} />
        </mesh>
      ))}

      {/* Leaves drifting through the air */}
      {fallingState.current.map((leaf, i) => (
        <mesh
          key={`fl-${i}`}
          ref={el => { fallingRefs.current[i] = el; }}
          geometry={LEAF_GEOMS[leaf.geomIdx]}
        >
          <meshBasicMaterial color={leaf.color} side={DoubleSide} transparent opacity={0.88} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

// ── Grazing animals (overcast fog) ───────────────────────────────────────────
// Smooth ShapeGeometry silhouettes — single side-profile outline per animal.
// ShapeGeometry sits in the XY plane, so the camera approaching from +Z sees the
// full silhouette straight-on; DoubleSide covers the reverse angle.

function makeCowShape(): Shape {
  const s = new Shape();
  // Trace the full outline counter-clockwise, starting at front outer hoof.
  // Cow faces RIGHT (+x = head, -x = tail). y=0 = ground.
  s.moveTo(0.62, 0);
  s.lineTo(0.62, 0.88);                                        // outer front leg up
  s.bezierCurveTo(0.66, 0.96, 0.76, 1.16, 0.82, 1.38);        // chest
  s.bezierCurveTo(0.86, 1.52, 0.94, 1.64, 1.06, 1.70);        // neck slope
  s.bezierCurveTo(1.16, 1.76, 1.32, 1.78, 1.46, 1.72);        // forehead
  s.bezierCurveTo(1.60, 1.66, 1.68, 1.52, 1.62, 1.38);        // nose
  s.bezierCurveTo(1.56, 1.24, 1.42, 1.17, 1.26, 1.18);        // jaw / chin
  s.bezierCurveTo(1.12, 1.20, 1.00, 1.28, 0.90, 1.40);        // throat
  s.bezierCurveTo(0.84, 1.22, 0.74, 1.05, 0.48, 0.90);        // chest inner
  s.lineTo(0.48, 0);                                            // inner front leg down
  s.lineTo(0.28, 0);                                            // across front gap
  s.bezierCurveTo(0.20, 0.80, -0.20, 0.78, -0.50, 0.80);      // belly
  s.lineTo(-0.50, 0);                                           // inner back leg down
  s.lineTo(-0.72, 0);                                           // across back gap
  s.lineTo(-0.72, 0.88);                                        // outer back leg up
  s.bezierCurveTo(-0.76, 0.96, -0.92, 1.14, -0.92, 1.34);     // rump curve
  s.bezierCurveTo(-0.92, 1.52, -0.80, 1.66, -0.64, 1.70);     // upper rump
  s.bezierCurveTo(-0.30, 1.76, 0.22, 1.74, 0.54, 1.70);       // back ridge (slight sway)
  s.bezierCurveTo(0.66, 1.66, 0.76, 1.57, 0.78, 1.46);        // withers
  s.bezierCurveTo(0.80, 1.34, 0.76, 1.16, 0.62, 0.88);        // withers to outer front leg top
  s.closePath();
  return s;
}

function makeGoatShape(): Shape {
  const s = new Shape();
  // Goat: slimmer body, longer legs, more upright neck, small horns as part of head outline.
  // Faces RIGHT, y=0 = ground.
  s.moveTo(0.48, 0);
  s.lineTo(0.48, 1.06);                                        // outer front leg (longer than cow)
  s.bezierCurveTo(0.52, 1.14, 0.60, 1.30, 0.64, 1.48);       // chest → neck (more upright)
  s.bezierCurveTo(0.68, 1.60, 0.72, 1.72, 0.78, 1.80);       // neck to poll
  // Horn bump (part of head outline)
  s.bezierCurveTo(0.82, 1.90, 0.90, 1.98, 0.96, 1.94);       // left horn
  s.bezierCurveTo(1.00, 1.90, 0.98, 1.82, 0.98, 1.76);       // between horns
  s.bezierCurveTo(1.02, 1.92, 1.10, 2.00, 1.16, 1.96);       // right horn
  s.bezierCurveTo(1.22, 1.92, 1.24, 1.84, 1.22, 1.76);       // down from horn
  s.bezierCurveTo(1.28, 1.68, 1.34, 1.56, 1.30, 1.44);       // nose / face
  s.bezierCurveTo(1.26, 1.32, 1.16, 1.26, 1.04, 1.28);       // chin / beard stub
  s.bezierCurveTo(0.94, 1.30, 0.84, 1.40, 0.76, 1.52);       // throat
  s.bezierCurveTo(0.70, 1.36, 0.62, 1.18, 0.38, 1.06);       // chest inner
  s.lineTo(0.38, 0);                                            // inner front leg
  s.lineTo(0.22, 0);                                            // across front gap
  s.bezierCurveTo(0.14, 0.88, -0.16, 0.84, -0.38, 0.86);     // belly (arched)
  s.lineTo(-0.38, 0);                                           // inner back leg
  s.lineTo(-0.58, 0);                                           // across back gap
  s.lineTo(-0.58, 1.06);                                        // outer back leg up
  s.bezierCurveTo(-0.62, 1.14, -0.76, 1.30, -0.74, 1.52);    // rump
  s.bezierCurveTo(-0.72, 1.66, -0.60, 1.74, -0.44, 1.74);    // high rump
  s.bezierCurveTo(-0.20, 1.74, 0.14, 1.70, 0.34, 1.64);      // back (relatively flat)
  s.bezierCurveTo(0.46, 1.60, 0.56, 1.52, 0.58, 1.40);       // withers
  s.bezierCurveTo(0.60, 1.28, 0.56, 1.14, 0.48, 1.06);       // withers to outer front leg
  s.closePath();
  return s;
}

// Shared geometry singletons — built once, reused across all animal instances
const COW_GEOM  = new ShapeGeometry(makeCowShape(),  16);
const GOAT_GEOM = new ShapeGeometry(makeGoatShape(), 16);

function CowMesh({ color }: { color: string }) {
  return (
    <mesh geometry={COW_GEOM}>
      <meshBasicMaterial color={color} side={DoubleSide} />
    </mesh>
  );
}

function GoatMesh({ color }: { color: string }) {
  return (
    <mesh geometry={GOAT_GEOM}>
      <meshBasicMaterial color={color} side={DoubleSide} />
    </mesh>
  );
}

const ANIMAL_COUNT = 7;

function GrazingAnimals({ groundY }: { groundY: number }) {
  const states = useRef(
    (() => {
      const rng = makeRng(33333);
      return Array.from({ length: ANIMAL_COUNT }, () => ({
        x:        (rng() - 0.5) * 50,
        z:        -(22 + rng() * 18),
        rotY:     rng() * Math.PI * 2,
        driftX:   (rng() - 0.5) * 0.005,
        bobPhase: rng() * Math.PI * 2,
        type:     rng() > 0.55 ? 'cow' : 'goat' as 'cow' | 'goat',
      }));
    })()
  );

  const groupRefs = useRef<(any | null)[]>(Array(ANIMAL_COUNT).fill(null));

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    states.current.forEach((s, i) => {
      s.x += s.driftX;
      if (Math.abs(s.x) > 35) s.driftX *= -1;

      // Respawn in the fog zone if camera drifts past us
      if (s.z > camera.position.z - 13) {
        s.z    = camera.position.z - 24 - Math.random() * 16;
        s.x    = (Math.random() - 0.5) * 50;
        s.rotY = Math.random() * Math.PI * 2;
      }

      const g = groupRefs.current[i];
      if (!g) return;
      g.position.set(s.x, groundY, s.z);
      // Slow grazing pitch: negative x rotation = head dips forward
      g.rotation.x = Math.sin(t * 0.6 + s.bobPhase) * 0.07 - 0.05;
      g.rotation.y = s.rotY;
    });
  });

  return (
    <>
      {states.current.map((s, i) => (
        <group key={i} ref={el => { groupRefs.current[i] = el; }}>
          {s.type === 'cow'
            ? <CowMesh color="#1C1814" />
            : <GoatMesh color="#131610" />}
        </group>
      ))}
    </>
  );
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function mkMountainHex(palette: Palette, brightness: number): string {
  const bg = new Color(palette.background);
  const g  = (bg.r + bg.g + bg.b) / 3;
  const c = new Color(
    (bg.r * 0.28 + g * 0.72) * brightness,
    (bg.g * 0.24 + g * 0.76) * brightness,
    (bg.b * 0.34 + g * 0.66) * brightness,
  );
  return `#${c.getHexString()}`;
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  palette: Palette;
  groundY: number;
  weatherState: WeatherState;
}

export default function NaturalBackground({ palette, groundY, weatherState }: Props) {
  const isSnow    = weatherState === 'snow';
  const isFog     = weatherState === 'fog' || weatherState === 'fog-night';
  const isAutumn  = weatherState === 'clear-day' || weatherState === 'partly-cloudy';
  const isOvercast = weatherState === 'overcast';

  const mountainColors = useMemo(() => {
    if (isSnow) return ['#6880A0', '#8CA0B8', '#B4C4D4'];
    return [
      mkMountainHex(palette, 0.22),
      mkMountainHex(palette, 0.40),
      mkMountainHex(palette, 0.58),
    ];
  }, [palette, isSnow]);

  const foliageColor = isSnow
    ? '#C8D8E8'
    : palette.isDark ? '#04080A' : '#0E2214';

  const trunkColor = palette.isDark ? '#060608' : '#1A1008';

  return (
    <>
      {/* Mountain ridges — 3 layers, farthest rendered first */}
      <MountainRidge z={-260} color={mountainColors[2]} peakHeight={24} width={560} seed={11}  groundY={groundY} />
      <MountainRidge z={-150} color={mountainColors[1]} peakHeight={19} width={400} seed={37}  groundY={groundY} />
      <MountainRidge z={-85}  color={mountainColors[0]} peakHeight={14} width={280} seed={73}  groundY={groundY} />

      {/* Pine forest — hidden in fog */}
      {!isFog && (
        <>
          <ForestRow z={-58} count={20} spread={220} groundY={groundY} avgHeight={7}  seed={101} foliageColor={foliageColor} trunkColor={trunkColor} />
          <ForestRow z={-32} count={15} spread={150} groundY={groundY} avgHeight={9}  seed={213} foliageColor={foliageColor} trunkColor={trunkColor} />
          <ForestRow z={-18} count={10} spread={90}  groundY={groundY} avgHeight={11} seed={317} foliageColor={foliageColor} trunkColor={trunkColor} />
        </>
      )}

      {/* Fallen leaves for warm clear/partly-cloudy days */}
      {isAutumn && <FallenLeaves groundY={groundY} />}

      {/* Grazing animals for overcast rural scenes */}
      {isOvercast && <GrazingAnimals groundY={groundY} />}
    </>
  );
}
