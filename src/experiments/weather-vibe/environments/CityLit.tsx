import { useEffect, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Fog } from 'three';
import type { Group, DirectionalLight, AmbientLight } from 'three';
import type { WeatherState } from '../conditions';

/**
 * Real lighting for buildings, isolated from the rest of the scene.
 *
 * The problem with simply switching buildings to a lit material: the eleven
 * environments set `ambientLight` anywhere from 0.04 (ClearNight) to 1.4
 * (ClearDay). A lambert surface multiplies by whatever lights it can see, so
 * the same building would be black in one weather and blown out in another,
 * and fixing that centrally means retuning every environment — which also
 * changes the ground planes and grass those ambients were balanced for.
 *
 * Layers make the lighting local. Buildings are moved off layer 0 entirely
 * and onto their own, along with a dedicated sun and fill. Environment lights
 * stay on layer 0 and cannot reach them; these lights cannot reach anything
 * else. Exposure becomes a property of the table below rather than a
 * side-effect of the weather, and nothing outside this component changes.
 *
 * The camera has to be told about the layer or the buildings vanish, so that
 * happens here rather than anywhere else — the enable and the layer
 * assignment are colocated so they cannot drift apart.
 */

const CITY_LAYER = 2;

interface LightSetup {
  /** Direction the light arrives FROM, in world units. */
  dir: [number, number, number];
  sun: number;
  sunColor: string;
  ambient: number;
  ambientColor: string;
}

/**
 * Per-weather lighting. Two numbers carry most of the character: the sun/fill
 * ratio (contrast) and the direction (time of day).
 *
 * Overcast deliberately keeps a weak sun rather than none — a perfectly
 * diffuse sky renders boxes flat, which is the look we just spent effort
 * escaping. Real overcast still has a bright patch where the sun is.
 *
 * Golden hour points the sun low and nearly behind the city, matching the
 * directional GoldenHour already declares at [30, 8, -200] and which currently
 * illuminates nothing, since no object in that file uses a lit material. A
 * backlit skyline against a low sun is the best frame this scene can produce.
 */
/**
 * Colours are near-white TINTS, deliberately. A light's colour multiplies its
 * intensity, so the first version of this table — which used believable
 * mid-grey and dusk-purple hex values like #9FA3A2 and #6E5A78 — was dimming
 * everything by an order of magnitude on top of the intensity. #9FA3A2 is
 * ~0.13 in linear space, so an 0.68 ambient delivered about 0.09 and the
 * buildings rendered as near-black cutouts.
 *
 * Hue belongs here; level belongs in the intensity numbers. Night states are
 * the exception — their tints stay deep because the darkness IS the hue.
 */
const CITY_LIGHT: Record<WeatherState, LightSetup> = {
  'clear-day':            { dir: [-60, 70, 40],   sun: 0.95, sunColor: '#FFF6E2', ambient: 0.46, ambientColor: '#DCE8F7' },
  'golden-hour':          { dir: [40, 14, -120],  sun: 1.15, sunColor: '#FFC078', ambient: 0.38, ambientColor: '#C8B4D0' },
  'clear-night':          { dir: [-40, 50, 30],   sun: 0.30, sunColor: '#9FB4E0', ambient: 0.22, ambientColor: '#4A5578' },
  'partly-cloudy':        { dir: [-50, 60, 35],   sun: 0.70, sunColor: '#FFF3E0', ambient: 0.56, ambientColor: '#DCE6F2' },
  'partly-cloudy-night':  { dir: [-40, 50, 30],   sun: 0.32, sunColor: '#93A6C4', ambient: 0.24, ambientColor: '#424D6E' },
  'overcast':             { dir: [-30, 60, 20],   sun: 0.34, sunColor: '#F4F4F0', ambient: 0.74, ambientColor: '#DEE2E0' },
  'fog':                  { dir: [-20, 50, 10],   sun: 0.26, sunColor: '#F0F4E8', ambient: 0.78, ambientColor: '#E0E5D8' },
  'fog-night':            { dir: [-20, 45, 10],   sun: 0.22, sunColor: '#8A97A4', ambient: 0.26, ambientColor: '#3C444E' },
  'rain':                 { dir: [-35, 55, 25],   sun: 0.34, sunColor: '#C4DCE8', ambient: 0.48, ambientColor: '#6E8496' },
  'snow':                 { dir: [-45, 65, 30],   sun: 0.55, sunColor: '#FFFFFF', ambient: 0.82, ambientColor: '#E6EEF8' },
  'storm':                { dir: [-30, 50, 20],   sun: 0.30, sunColor: '#8FA4D6', ambient: 0.34, ambientColor: '#38425C' },
};

/**
 * Pushes the fog back far enough for a city to exist inside it.
 *
 * Every environment declares linear fog tuned for a meadow: Fog is
 * `[colour, 5, 40]`, meaning fully opaque at 40 units, and Overcast is
 * `[colour, 5, 45]`. Correct when the camera sits at eye level looking at
 * trees a few units away. A city spans z -30 to -119 and the camera is lifted
 * above it, so real distances run past 120 — the entire skyline sat beyond the
 * far plane and rendered as flat fog-coloured slabs. Not buildings missing
 * their windows: buildings erased.
 *
 * Scaled rather than replaced, so each weather keeps its own relative density
 * — fog stays much thicker than partly-cloudy. The near plane moves out too,
 * otherwise haze starts before the nearest tower and the city greys out from
 * the front.
 *
 * Written every frame from a captured base rather than multiplied in place:
 * environments remount and build a fresh Fog, and compounding a multiplier
 * would drive the far plane to infinity.
 */
function useCityFog(nearScale: number, farScale: number) {
  const lastFog = useRef<Fog | null>(null);
  const base = useRef({ near: 0, far: 0 });

  useFrame(({ scene }) => {
    const fog = scene.fog;
    if (!fog || !(fog instanceof Fog)) return;

    if (lastFog.current !== fog) {
      lastFog.current = fog;
      base.current = { near: fog.near, far: fog.far };
    }

    fog.near = base.current.near * nearScale;
    // Capped below the camera's far plane (1000); GoldenHour already reaches
    // 280, and scaling that unchecked would put the fog end past the frustum.
    fog.far = Math.min(base.current.far * farScale, 900);
  });
}

interface Props {
  state: WeatherState;
  /** Cities need the fog pushed back much further than towns. */
  fogScale?: { near: number; far: number };
  children: ReactNode;
}

export default function CityLit({ state, fogScale, children }: Props) {
  useCityFog(fogScale?.near ?? 1, fogScale?.far ?? 1);

  const camera = useThree((s) => s.camera);
  const groupRef = useRef<Group>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const fillRef = useRef<AmbientLight>(null);

  const setup = CITY_LIGHT[state];

  useEffect(() => {
    camera.layers.enable(CITY_LAYER);
    return () => camera.layers.disable(CITY_LAYER);
  }, [camera]);

  // No dependency array on purpose. Buildings are rebuilt when relief or the
  // weather changes, and a missed traversal means a mesh stays on layer 0 —
  // where it is lit by the environment instead, which is exactly the bug this
  // component exists to prevent. Traversing ~35 objects per render is cheaper
  // than being subtly wrong.
  useEffect(() => {
    groupRef.current?.traverse((o) => o.layers.set(CITY_LAYER));
    sunRef.current?.layers.set(CITY_LAYER);
    fillRef.current?.layers.set(CITY_LAYER);
  });

  return (
    <group ref={groupRef}>
      <ambientLight ref={fillRef} intensity={setup.ambient} color={setup.ambientColor} />
      <directionalLight
        ref={sunRef}
        position={setup.dir}
        intensity={setup.sun}
        color={setup.sunColor}
      />
      {children}
    </group>
  );
}
