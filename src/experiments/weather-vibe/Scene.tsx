import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { FORWARD_DRIFT, forwardDrift, framingFor } from './cameraRig';
import { landmarksFor, layoutFor } from './cityLayout';
import { EffectComposer, Vignette, Noise, ChromaticAberration, Bloom } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import { type WeatherData, type WeatherState, PALETTES } from './conditions';
import { usePan } from './usePan';
import ClearNight from './environments/ClearNight';
import GoldenHour from './environments/GoldenHour';
import ClearDay from './environments/ClearDay';
import Rain from './environments/Rain';
import Fog from './environments/Fog';
import FogNight from './environments/FogNight';
import Snow from './environments/Snow';
import Storm from './environments/Storm';
import PartlyCloudy from './environments/PartlyCloudy';
import PartlyCloudyNight from './environments/PartlyCloudyNight';
import Overcast from './environments/Overcast';
import CityScape from './environments/CityScape';
import CityHills from './environments/CityHills';
import CityGround from './environments/CityGround';
import CityLit from './environments/CityLit';
import SmallTown from './environments/SmallTown';
import NaturalBackground from './environments/NaturalBackground';
import TropicalBackground from './environments/TropicalBackground';
import CoastalBackground from './environments/CoastalBackground';
import { useSettings } from './settings';

interface SceneProps {
  weather: WeatherData;
}

const FX: Record<string, { bloom: number; vignette: number; ca: number; noise: number }> = {
  'clear-day':     { bloom: 0.6, vignette: 0.2, ca: 0.001, noise: 0.02 },
  'golden-hour':   { bloom: 0.9, vignette: 0.35, ca: 0.002, noise: 0.025 },
  'clear-night':   { bloom: 0.8, vignette: 0.7, ca: 0.002, noise: 0.04 },
  'partly-cloudy':       { bloom: 0.2, vignette: 0.4, ca: 0.001, noise: 0.02 },
  'partly-cloudy-night': { bloom: 0.6, vignette: 0.6, ca: 0.002, noise: 0.03 },
  'overcast':      { bloom: 0.0, vignette: 0.6, ca: 0.001, noise: 0.04 },
  'fog':           { bloom: 0.2, vignette: 0.8, ca: 0.004, noise: 0.06 },
  'fog-night':     { bloom: 0.4, vignette: 0.9, ca: 0.003, noise: 0.05 },
  'rain':          { bloom: 0.2, vignette: 0.7, ca: 0.002, noise: 0.04 },
  'snow':          { bloom: 0.4, vignette: 0.4, ca: 0.001, noise: 0.02 },
  'storm':         { bloom: 0.3, vignette: 0.9, ca: 0.004, noise: 0.05 },
};

// Ground Y per weather state — buildings base-align to each scene's floor
const GROUND_Y: Record<WeatherState, number> = {
  'clear-day':           0,
  'golden-hour':         0,
  'clear-night':        -5,
  'partly-cloudy':      -5,
  'partly-cloudy-night':-5,
  'overcast':            0,
  'fog':                -2,
  'fog-night':          -2,
  'rain':               -2,
  'snow':               -2,
  'storm':              -2,
};

/**
 * The one place that decides where the camera ends up.
 *
 * Everything else that touches the camera keeps doing what it did — the
 * environments still drift x and y with their own signature sines, usePan
 * still applies the viewer's parallax and dolly as deltas. This composes on
 * top and owns exactly two things: framing height, and forward drift.
 *
 * It renders last so its useFrame registers after the environment's, which
 * matters because environments assign y outright every frame.
 *
 * Height uses a written/observed comparison rather than a clamp. If
 * camera.position.y is still exactly what this wrote last frame, the
 * environment did not assign one, so the previous environment value is reused
 * instead of adding to our own output — which is what would otherwise walk the
 * camera into orbit. Correct in both cases, no magic ceiling.
 *
 * Forward drift is applied as a delta, matching usePan's idiom, so the
 * viewer's own scroll-dolly still composes with it rather than being
 * overwritten.
 */
function CameraRig({ weather }: SceneProps) {
  const framing = framingFor(weather.urbanDensity, layoutFor(weather.city));
  const profile = FORWARD_DRIFT[weather.state];

  const lastWroteY = useRef<number | null>(null);
  const lastEnvY = useRef(0);
  const appliedZ = useRef(0);

  useFrame(({ camera, clock }) => {
    const envY =
      lastWroteY.current !== null && camera.position.y === lastWroteY.current
        ? lastEnvY.current
        : camera.position.y;
    lastEnvY.current = envY;

    const y = envY + framing.lift;
    camera.position.y = y;
    lastWroteY.current = y;

    const target = profile
      ? forwardDrift(clock.getElapsedTime(), {
          reach: profile.reach * framing.driftScale,
          period: profile.period,
        })
      : 0;
    camera.position.z += target - appliedZ.current;
    appliedZ.current = target;
  });

  return null;
}

function Environment({ weather }: SceneProps) {
  usePan();

  // Cities are paved. A meadow through downtown was the same category error
  // as a beach through downtown, just less obvious because it is short.
  const noGrass =
    weather.terrain === 'island' ||
    weather.terrain === 'coastal' ||
    weather.urbanDensity === 'urban';

  const scene = (() => {
    switch (weather.state) {
      case 'clear-day':            return <ClearDay noGrass={noGrass} />;
      case 'golden-hour':          return <GoldenHour noGrass={noGrass} />;
      case 'clear-night':          return <ClearNight noGrass={noGrass} />;
      case 'rain':                 return <Rain noGrass={noGrass} />;
      case 'fog':                  return <Fog noGrass={noGrass} />;
      case 'fog-night':            return <FogNight noGrass={noGrass} />;
      case 'snow':                 return <Snow noGrass={noGrass} />;
      case 'storm':                return <Storm noGrass={noGrass} />;
      case 'partly-cloudy':        return <PartlyCloudy noGrass={noGrass} />;
      case 'partly-cloudy-night':  return <PartlyCloudyNight noGrass={noGrass} />;
      case 'overcast':             return <Overcast noGrass={noGrass} />;
      default:                     return <ClearNight noGrass={noGrass} />;
    }
  })();

  /**
   * Terrain and density are independent axes, and they used to be tangled.
   * The old chain returned CityScape ALONE for anything over 200k people, so
   * every large city lost its geography: no bay behind San Francisco, no
   * Atlantic behind Miami, no ridgelines behind Portland or Denver. Towns got
   * a backdrop, cities did not, which was the tell that this was a mistake
   * rather than a decision.
   *
   * Now the backdrop always renders and the built layer sits in front of it.
   * The backdrops take `density` and drop their own near field for cities —
   * see CoastalBackground, where the beach would otherwise run through
   * downtown.
   */
  const palette  = PALETTES[weather.state];
  const groundY  = GROUND_Y[weather.state];
  const density  = weather.urbanDensity;
  const relief   = weather.relief ?? 0;
  const layout   = layoutFor(weather.city);

  const backdrop =
    weather.terrain === 'island' ? (
      <TropicalBackground palette={palette} groundY={groundY} weatherState={weather.state} density={density} />
    ) : weather.terrain === 'coastal' ? (
      <CoastalBackground palette={palette} groundY={groundY} weatherState={weather.state} density={density} />
    ) : (
      <NaturalBackground palette={palette} groundY={groundY} weatherState={weather.state} density={density} />
    );

  return (
    <>
      {scene}
      {backdrop}
      {/* Pavement first — it covers the rural soil plane the weather
          environment drew, which is otherwise a dark slab under the city. */}
      {density === 'urban' && <CityGround palette={palette} groundY={groundY} />}

      {/* Hills before the city: the land is behind and beneath the buildings,
          and both read the same height function so they agree. */}
      {density === 'urban' && <CityHills palette={palette} groundY={groundY} relief={relief} />}
      {/* Buildings are lit by their own per-weather sun on a private layer,
          so exposure does not swing with each environment's ambient. */}
      {/* A boulevard is a deliberate long view — it runs to z -300 and is meant
          to terminate in something. At the arc's fog depth the far end was
          already fog-coloured, so the vista had nothing to arrive at. */}
      {density === 'urban' && (
        <CityLit
          state={weather.state}
          fogScale={layout === 'boulevard' ? { near: 5, far: 8 } : { near: 5, far: 5.5 }}
        >
          <CityScape
            palette={palette}
            groundY={groundY}
            relief={relief}
            layout={layout}
            landmarks={landmarksFor(weather.city)}
          />
        </CityLit>
      )}
      {density === 'town' && (
        <CityLit state={weather.state} fogScale={{ near: 2, far: 2.2 }}>
          <SmallTown palette={palette} groundY={groundY} />
        </CityLit>
      )}

      {/* Last, so its useFrame runs after the environment sets the camera.
          Rendered for every density — rural framing is a no-op lift, but the
          rig still owns the forward drift. */}
      <CameraRig weather={weather} />
    </>
  );
}

export default function Scene({ weather }: SceneProps) {
  const fx = FX[weather.state] ?? FX['clear-night'];
  const { visuals } = useSettings();
  return (
    <Canvas
      camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 0] }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Environment weather={weather} />

      <EffectComposer>
        {/*
          Each slider runs 0–200%, and the curve is what makes the top half
          worth having.

          A plain multiplier capped at 1.0 could only ever subtract from the
          shipped look, and these baselines are tiny — chromatic aberration
          starts at 0.001–0.004 and grain at 0.02–0.06 opacity. Sliding those
          down from "barely there" to "nothing" is a change nobody can see,
          which is exactly how it felt.

          Raising them to a power gives headroom without moving the default:
          v = 1 is always exactly the value the weather intended, while v = 2
          multiplies by 2^p. The exponents differ because the effects do —
          grain and aberration need several times their base before they read
          at all, bloom and vignette are already strong and would blow out.
        */}
        <Bloom intensity={fx.bloom * visuals.bloom ** 1.5} luminanceThreshold={0.3} />
        <Vignette darkness={fx.vignette * visuals.vignette ** 1.2} offset={0.3} blendFunction={BlendFunction.NORMAL} />
        <ChromaticAberration offset={new Vector2(fx.ca * visuals.ca ** 2.5, fx.ca * visuals.ca ** 2.5)} />
        <Noise opacity={fx.noise * visuals.grain ** 2.5} />
      </EffectComposer>
    </Canvas>
  );
}
