import { Canvas } from '@react-three/fiber';
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

function Environment({ weather }: SceneProps) {
  usePan();

  const noGrass = weather.terrain === 'island' || weather.terrain === 'coastal';

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

  return (
    <>
      {scene}
      {weather.urbanDensity === 'urban' ? (
        <CityScape
          palette={PALETTES[weather.state]}
          groundY={GROUND_Y[weather.state]}
        />
      ) : weather.urbanDensity === 'town' ? (
        <>
          <SmallTown
            palette={PALETTES[weather.state]}
            groundY={GROUND_Y[weather.state]}
          />
          {weather.terrain === 'island' ? (
            <TropicalBackground
              palette={PALETTES[weather.state]}
              groundY={GROUND_Y[weather.state]}
              weatherState={weather.state}
            />
          ) : weather.terrain === 'coastal' ? (
            <CoastalBackground
              palette={PALETTES[weather.state]}
              groundY={GROUND_Y[weather.state]}
              weatherState={weather.state}
            />
          ) : (
            <NaturalBackground
              palette={PALETTES[weather.state]}
              groundY={GROUND_Y[weather.state]}
              weatherState={weather.state}
            />
          )}
        </>
      ) : weather.terrain === 'island' ? (
        <TropicalBackground
          palette={PALETTES[weather.state]}
          groundY={GROUND_Y[weather.state]}
          weatherState={weather.state}
        />
      ) : weather.terrain === 'coastal' ? (
        <CoastalBackground
          palette={PALETTES[weather.state]}
          groundY={GROUND_Y[weather.state]}
          weatherState={weather.state}
        />
      ) : (
        <NaturalBackground
          palette={PALETTES[weather.state]}
          groundY={GROUND_Y[weather.state]}
          weatherState={weather.state}
        />
      )}
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
        <Bloom intensity={fx.bloom * visuals.bloom} luminanceThreshold={0.3} />
        <Vignette darkness={fx.vignette * visuals.vignette} offset={0.3} blendFunction={BlendFunction.NORMAL} />
        <ChromaticAberration offset={new Vector2(fx.ca * visuals.ca, fx.ca * visuals.ca)} />
        <Noise opacity={fx.noise * visuals.grain} />
      </EffectComposer>
    </Canvas>
  );
}
