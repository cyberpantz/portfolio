# Weather Vibe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen immersive WebGL weather environment experiment using React Three Fiber, driven by real local weather data, with a meditative Feltron/Tufte/Sci-Fi aesthetic.

**Architecture:** R3F Canvas hosts weather-driven 3D environments. A DOM HUD layer overlays data. A Web Audio API manager handles procedural + recorded soundscapes. Open-Meteo provides free weather data via browser geolocation.

**Tech Stack:** React Three Fiber, @react-three/drei, @react-three/postprocessing, Three.js, Open-Meteo API, Web Audio API, GLSL shaders, Astro + React, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-07-weather-vibe-design.md`

---

## File Map

**Create:**
- `src/experiments/WeatherVibe.tsx` — root component, geolocation, weather fetch, state machine
- `src/experiments/weather-vibe/useWeather.ts` — geolocation + Open-Meteo hook
- `src/experiments/weather-vibe/conditions.ts` — WMO → WeatherState, palettes, vibe words
- `src/experiments/weather-vibe/Scene.tsx` — R3F Canvas, camera, postprocessing
- `src/experiments/weather-vibe/HUD.tsx` — DOM overlay
- `src/experiments/weather-vibe/audio.ts` — Web Audio API manager
- `src/experiments/weather-vibe/environments/ClearNight.tsx`
- `src/experiments/weather-vibe/environments/ClearDay.tsx`
- `src/experiments/weather-vibe/environments/Rain.tsx`
- `src/experiments/weather-vibe/environments/Fog.tsx`
- `src/experiments/weather-vibe/environments/Snow.tsx`
- `src/experiments/weather-vibe/environments/Storm.tsx`
- `src/experiments/weather-vibe/environments/PartlyCloudy.tsx`
- `src/experiments/weather-vibe/environments/Overcast.tsx`
- `src/experiments/weather-vibe/shaders/starField.frag.glsl`
- `src/experiments/weather-vibe/shaders/atmosphere.frag.glsl`
- `src/experiments/weather-vibe/shaders/wetGlass.frag.glsl`
- `src/experiments/weather-vibe/shaders/condensation.frag.glsl`
- `src/experiments/weather-vibe/shaders/heatShimmer.frag.glsl`
- `src/experiments/weather-vibe/shaders/fogMarch.frag.glsl`
- `src/pages/explorations/weather-vibe.astro`
- `public/audio/weather-vibe/.gitkeep` — placeholder for cricket asset

**Modify:**
- `package.json` — add three, @react-three/fiber, @react-three/drei, @react-three/postprocessing

---

## Task 1: Install dependencies and scaffold directory structure

**Files:**
- Modify: `package.json`
- Create: all `src/experiments/weather-vibe/` subdirectories and stub files

- [ ] **Step 1: Install packages**

```bash
pnpm add three @react-three/fiber @react-three/drei @react-three/postprocessing
pnpm add -D @types/three
```

Expected: packages added to package.json, no errors.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p src/experiments/weather-vibe/environments
mkdir -p src/experiments/weather-vibe/shaders
mkdir -p public/audio/weather-vibe
touch public/audio/weather-vibe/.gitkeep
```

- [ ] **Step 3: Create stub files for each module**

Create `src/experiments/weather-vibe/conditions.ts`:
```typescript
export type WeatherState =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

export interface WeatherData {
  state: WeatherState;
  temperature: number;
  windspeed: number;
  latitude: number;
  longitude: number;
}

export interface Palette {
  background: string;
  accent: string;
  vibe: string;
}

export const PALETTES: Record<WeatherState, Palette> = {
  'clear-day':     { background: '#87CEEB', accent: '#F5A623', vibe: 'OPEN' },
  'clear-night':   { background: '#0A0A1A', accent: '#C8D8F0', vibe: 'STILL' },
  'partly-cloudy': { background: '#B0C4D8', accent: '#7B9FC7', vibe: 'DRIFTING' },
  'overcast':      { background: '#7A7A7A', accent: '#9A9A9A', vibe: 'MUTED' },
  'fog':           { background: '#C8CCBE', accent: '#A0B09A', vibe: 'ADRIFT' },
  'rain':          { background: '#1A2A3A', accent: '#2A7A8A', vibe: 'INSIDE' },
  'snow':          { background: '#E8EEF4', accent: '#D0E0F0', vibe: 'HUSHED' },
  'storm':         { background: '#050810', accent: '#2244AA', vibe: 'ELECTRIC' },
};

// WMO weather interpretation code → WeatherState
export function wmoToState(code: number, isDay: boolean): WeatherState {
  if (code === 0) return isDay ? 'clear-day' : 'clear-night';
  if (code <= 2)  return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if (code <= 48) return 'fog';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}
```

- [ ] **Step 4: Create the Astro page**

Create `src/pages/explorations/weather-vibe.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import WeatherVibe from '../../experiments/WeatherVibe';
---
<Base title="Weather Vibe — Frank Young" description="A meditative 3D environment that lives in your local weather.">
  <WeatherVibe client:load />
</Base>
```

- [ ] **Step 5: Verify build still passes**

```bash
pnpm run build
```

Expected: build completes with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold weather-vibe experiment — deps, dirs, conditions, page"
```

---

## Task 2: Weather data hook

**Files:**
- Create: `src/experiments/weather-vibe/useWeather.ts`

- [ ] **Step 1: Write the hook**

Create `src/experiments/weather-vibe/useWeather.ts`:
```typescript
import { useState, useEffect } from 'react';
import { wmoToState, type WeatherData } from './conditions';

type Status = 'locating' | 'fetching' | 'ready' | 'error';

interface UseWeatherResult {
  weather: WeatherData | null;
  status: Status;
}

const FALLBACK: WeatherData = {
  state: 'clear-night',
  temperature: 18,
  windspeed: 5,
  latitude: 0,
  longitude: 0,
};

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<Status>('locating');

  useEffect(() => {
    if (!navigator.geolocation) {
      setWeather(FALLBACK);
      setStatus('ready');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setStatus('fetching');
        try {
          const { latitude, longitude } = coords;
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
          const res = await fetch(url);
          const data = await res.json();
          const cw = data.current_weather;
          setWeather({
            state: wmoToState(cw.weathercode, cw.is_day === 1),
            temperature: cw.temperature,
            windspeed: cw.windspeed,
            latitude,
            longitude,
          });
          setStatus('ready');
        } catch {
          setWeather(FALLBACK);
          setStatus('ready');
        }
      },
      () => {
        setWeather(FALLBACK);
        setStatus('ready');
      }
    );
  }, []);

  return { weather, status };
}
```

- [ ] **Step 2: Verify type check**

```bash
pnpm exec astro check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/experiments/weather-vibe/useWeather.ts src/experiments/weather-vibe/conditions.ts
git commit -m "feat: weather data hook — geolocation + Open-Meteo + WMO state mapping"
```

---

## Task 3: Root component + Scene scaffold + HUD

**Files:**
- Create: `src/experiments/WeatherVibe.tsx`
- Create: `src/experiments/weather-vibe/Scene.tsx`
- Create: `src/experiments/weather-vibe/HUD.tsx`

- [ ] **Step 1: Write HUD component**

Create `src/experiments/weather-vibe/HUD.tsx`:
```tsx
import { useEffect, useState } from 'react';
import type { WeatherData } from './conditions';
import { PALETTES } from './conditions';

interface HUDProps {
  weather: WeatherData;
  status: string;
}

export default function HUD({ weather, status }: HUDProps) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-GB'));
  const palette = PALETTES[weather.state];
  const accent = palette.accent;

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB')), 1000);
    return () => clearInterval(id);
  }, []);

  const hudStyle = { color: accent, fontFamily: 'monospace', opacity: 0.6 };
  const dimStyle = { ...hudStyle, opacity: 0.3, fontSize: 10 };

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>

      {/* Scan lines */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
        pointerEvents: 'none',
      }} />

      {/* Corner brackets */}
      {[
        'top-0 left-0 border-t border-l',
        'top-0 right-0 border-t border-r',
        'bottom-0 left-0 border-b border-l',
        'bottom-0 right-0 border-b border-r',
      ].map((cls) => (
        <div key={cls} className={`absolute w-6 h-6 m-3 ${cls}`}
          style={{ borderColor: accent, opacity: 0.4 }} />
      ))}

      {/* Top-left: coordinates */}
      <div className="absolute top-5 left-5" style={dimStyle}>
        <div>{weather.latitude.toFixed(4)}° N</div>
        <div>{weather.longitude.toFixed(4)}° E</div>
        {status === 'fetching' && <div style={{ marginTop: 4 }}>SYNCING...</div>}
        {weather.latitude === 0 && <div style={{ marginTop: 4 }}>LOCATION UNKNOWN</div>}
      </div>

      {/* Top-right: time + condition */}
      <div className="absolute top-5 right-5 text-right" style={dimStyle}>
        <div style={{ fontSize: 12, opacity: 1 }}>{time}</div>
        <div style={{ marginTop: 2 }}>{weather.state.toUpperCase().replace('-', ' ')}</div>
      </div>

      {/* Bottom-left: temp + wind */}
      <div className="absolute bottom-5 left-5" style={dimStyle}>
        <div>{weather.temperature.toFixed(1)}°C / {(weather.temperature * 9/5 + 32).toFixed(1)}°F</div>
        <div>{weather.windspeed} km/h</div>
      </div>

      {/* Bottom-right: vibe word */}
      <div className="absolute bottom-5 right-5 text-right" style={{
        ...hudStyle,
        fontSize: 14,
        letterSpacing: '0.2em',
        opacity: 0.6,
      }}>
        {palette.vibe}
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Write Scene scaffold**

Create `src/experiments/weather-vibe/Scene.tsx`:
```tsx
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Vignette, Noise, ChromaticAberration, Bloom } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import type { WeatherData } from './conditions';
import ClearNight from './environments/ClearNight';

interface SceneProps {
  weather: WeatherData;
}

// Postprocessing settings per state
const FX: Record<string, { bloom: number; vignette: number; ca: number; noise: number }> = {
  'clear-day':     { bloom: 0.6, vignette: 0.2, ca: 0.001, noise: 0.02 },
  'clear-night':   { bloom: 0.8, vignette: 0.7, ca: 0.002, noise: 0.04 },
  'partly-cloudy': { bloom: 0.2, vignette: 0.4, ca: 0.001, noise: 0.02 },
  'overcast':      { bloom: 0.0, vignette: 0.6, ca: 0.001, noise: 0.04 },
  'fog':           { bloom: 0.2, vignette: 0.8, ca: 0.004, noise: 0.06 },
  'rain':          { bloom: 0.2, vignette: 0.7, ca: 0.002, noise: 0.04 },
  'snow':          { bloom: 0.4, vignette: 0.4, ca: 0.001, noise: 0.02 },
  'storm':         { bloom: 0.3, vignette: 0.9, ca: 0.004, noise: 0.05 },
};

function Environment({ weather }: SceneProps) {
  // Route to environment component based on state
  switch (weather.state) {
    case 'clear-night': return <ClearNight />;
    // Other environments added in later tasks
    default: return <ClearNight />;
  }
}

export default function Scene({ weather }: SceneProps) {
  const fx = FX[weather.state] ?? FX['clear-night'];

  return (
    <Canvas
      camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 0] }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Environment weather={weather} />

      <EffectComposer>
        {fx.bloom > 0 && <Bloom intensity={fx.bloom} luminanceThreshold={0.3} />}
        <Vignette darkness={fx.vignette} offset={0.3} blendFunction={BlendFunction.NORMAL} />
        <ChromaticAberration offset={new Vector2(fx.ca, fx.ca)} />
        <Noise opacity={fx.noise} />
      </EffectComposer>
    </Canvas>
  );
}
```

- [ ] **Step 3: Write root component**

Create `src/experiments/WeatherVibe.tsx`:
```tsx
import { useWeather } from './weather-vibe/useWeather';
import Scene from './weather-vibe/Scene';
import HUD from './weather-vibe/HUD';
import { PALETTES } from './weather-vibe/conditions';

export default function WeatherVibe() {
  const { weather, status } = useWeather();

  // Show dark screen while locating
  if (!weather) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <span style={{ fontFamily: 'monospace', color: '#C8D8F0', fontSize: 11, opacity: 0.4, letterSpacing: '0.2em' }}>
          LOCATING...
        </span>
      </div>
    );
  }

  const bg = PALETTES[weather.state].background;

  return (
    <div className="fixed inset-0" style={{ background: bg }}>
      <Scene weather={weather} />
      <HUD weather={weather} status={status} />
    </div>
  );
}
```

- [ ] **Step 4: Create stub ClearNight so it builds**

Create `src/experiments/weather-vibe/environments/ClearNight.tsx`:
```tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export default function ClearNight() {
  const groupRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.004;
  });
  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.05} />
    </group>
  );
}
```

- [ ] **Step 5: Check build**

```bash
pnpm run build
```

Expected: builds successfully. Navigate to `/explorations/weather-vibe` — see a dark screen that resolves to the HUD with your coordinates and "STILL" in the corner.

- [ ] **Step 6: Commit**

```bash
git add src/experiments/WeatherVibe.tsx src/experiments/weather-vibe/Scene.tsx src/experiments/weather-vibe/HUD.tsx src/experiments/weather-vibe/environments/ClearNight.tsx
git commit -m "feat: weather-vibe scaffold — root, scene, HUD, clear-night stub"
```

---

## Task 4: Star field shader + ClearNight environment

**Files:**
- Create: `src/experiments/weather-vibe/shaders/starField.frag.glsl`
- Modify: `src/experiments/weather-vibe/environments/ClearNight.tsx`

- [ ] **Step 1: Write star field fragment shader**

Create `src/experiments/weather-vibe/shaders/starField.frag.glsl`:
```glsl
uniform float uTime;
varying vec3 vPosition;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // Normalize direction
  vec3 dir = normalize(vPosition);
  // Map to 2D for star grid
  vec2 uv = vec2(atan(dir.z, dir.x) / 6.2832 + 0.5, asin(dir.y) / 3.1416 + 0.5);

  vec3 color = vec3(0.01, 0.01, 0.05);

  // Two layers of stars — foreground and background
  for (float scale = 150.0; scale <= 300.0; scale += 150.0) {
    vec2 grid = floor(uv * scale);
    vec2 f = fract(uv * scale);
    float seed = hash(grid);
    if (seed > 0.65) { // ~35% of cells have a star
      vec2 starPos = vec2(hash(grid + 0.3), hash(grid + 0.7));
      float dist = length(f - starPos);
      float size = 0.02 + seed * 0.03;
      float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + seed * 4.0) + seed * 20.0);
      float brightness = smoothstep(size, 0.0, dist) * twinkle;
      // Color temperature: warm to cool
      vec3 starColor = mix(vec3(1.0, 0.85, 0.6), vec3(0.7, 0.85, 1.0), seed);
      color += starColor * brightness * (scale == 150.0 ? 1.0 : 0.4);
    }
  }

  // Subtle nebula haze in upper hemisphere
  float nebula = smoothstep(-0.1, 0.6, dir.y) * 0.04;
  color += vec3(0.2, 0.1, 0.4) * nebula;

  gl_FragColor = vec4(color, 1.0);
}
```

- [ ] **Step 2: Write vertex shader**

Create `src/experiments/weather-vibe/shaders/starField.vert.glsl`:
```glsl
varying vec3 vPosition;
void main() {
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

- [ ] **Step 3: Rewrite ClearNight with full star sphere, moon, fireflies**

Replace `src/experiments/weather-vibe/environments/ClearNight.tsx`:
```tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, SphereGeometry, Color, BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';
import type { Group, Points } from 'three';
// @ts-ignore — glsl imports handled by vite
import starFrag from '../shaders/starField.frag.glsl?raw';
// @ts-ignore
import starVert from '../shaders/starField.vert.glsl?raw';

function StarSphere() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh scale={[-1, 1, 1]}> {/* invert so we see inside */}
      <sphereGeometry args={[500, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={starVert}
        fragmentShader={starFrag}
        uniforms={uniforms}
        side={2} /* BackSide */
      />
    </mesh>
  );
}

function Moon() {
  return (
    <group position={[80, 60, -200]}>
      <mesh>
        <sphereGeometry args={[8, 32, 32]} />
        <meshStandardMaterial color="#E8E0D0" emissive="#C8C0A0" emissiveIntensity={0.4} />
      </mesh>
      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[12, 32, 32]} />
        <meshStandardMaterial color="#8080A0" transparent opacity={0.06} />
      </mesh>
      <pointLight color="#C8D0F0" intensity={0.8} distance={400} />
    </group>
  );
}

function Fireflies() {
  const pointsRef = useRef<Points>(null);
  const count = 80;

  const { positions, phases } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 3 - 1;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, phases };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3]     += Math.sin(t * 0.3 + phases[i]) * 0.003;
      pos[i * 3 + 2] += Math.cos(t * 0.2 + phases[i]) * 0.003;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    // Flicker via opacity — use userData to track
    (pointsRef.current.material as any).opacity =
      0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + 1.2));
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#AAFFAA"
        size={0.15}
        transparent
        opacity={0.6}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function ClearNight() {
  const groupRef = useRef<Group>(null);

  // Very slow rotation — one full revolution in ~4 minutes
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.0026;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.04} color="#1A1A3E" />
      <StarSphere />
      <Moon />
      <Fireflies />
    </group>
  );
}
```

- [ ] **Step 4: Add vite glsl raw import support**

In `astro.config.mjs`, verify vite handles `?raw` imports (it does by default in Vite 4+). If GLSL imports fail, add to vite config:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
// existing imports...

export default defineConfig({
  // existing config...
  vite: {
    assetsInclude: ['**/*.glsl'],
  },
});
```

- [ ] **Step 5: Test in browser**

```bash
pnpm dev
```

Navigate to `/explorations/weather-vibe`. You should see:
- A slowly rotating star field with twinkling stars
- A moon with soft glow
- Fireflies drifting at ground level
- HUD with coordinates, time, "STILL" vibe word

- [ ] **Step 6: Commit**

```bash
git add src/experiments/weather-vibe/shaders/ src/experiments/weather-vibe/environments/ClearNight.tsx
git commit -m "feat: clear-night environment — star field shader, moon, fireflies"
```

---

## Task 5: Audio manager + procedural soundscape

> **⚠️ AUDIO GATE:** `clear-night` audio requires a CC0 cricket field recording.
> Before wiring audio for `clear-night`:
> 1. Source a looping cricket recording from freesound.org (CC0, stereo, 60–120s, minimal wind noise)
> 2. Export as MP3, place at `public/audio/weather-vibe/crickets.mp3`
> 3. Confirm the file is in place, then proceed with `ClearNight` audio wiring
>
> All other states use procedural synthesis and can be built without external assets.

**Files:**
- Create: `src/experiments/weather-vibe/audio.ts`

- [ ] **Step 1: Write audio manager**

Create `src/experiments/weather-vibe/audio.ts`:
```typescript
import type { WeatherState } from './conditions';

class WeatherAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: AudioNode[] = [];
  private recording: AudioBufferSourceNode | null = null;
  private currentState: WeatherState | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      // Fade in
      this.master.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 4);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private stopAll() {
    this.active.forEach(n => {
      try { (n as OscillatorNode).stop?.(); } catch {}
    });
    this.active = [];
    if (this.recording) {
      try { this.recording.stop(); } catch {}
      this.recording = null;
    }
  }

  // Filtered noise — base for wind and rain
  private noise(gain: number, lowHz: number, highHz: number, dest: AudioNode): OscillatorNode | undefined {
    const ctx = this.getCtx();
    const bufSize = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lo = ctx.createBiquadFilter();
    lo.type = 'highpass';
    lo.frequency.value = lowHz;

    const hi = ctx.createBiquadFilter();
    hi.type = 'lowpass';
    hi.frequency.value = highHz;

    const g = ctx.createGain();
    g.gain.value = gain;

    src.connect(lo);
    lo.connect(hi);
    hi.connect(g);
    g.connect(dest);
    src.start();

    this.active.push(src, lo, hi, g);
    return undefined;
  }

  // Procedural wind
  private wind(intensity: number, dest: AudioNode) {
    this.noise(intensity * 0.15, 200, 800, dest);
    this.noise(intensity * 0.05, 50, 200, dest);
  }

  // Procedural rain on glass — dense high-frequency noise with resonance
  private rainOnGlass(dest: AudioNode) {
    const ctx = this.getCtx();
    this.noise(0.3, 1000, 8000, dest);
    // Add resonant ringing for droplet character
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 3200;
    osc.type = 'sine';
    g.gain.value = 0.02;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    this.active.push(osc, g);
  }

  // Procedural fog drone — very low, barely present
  private fogDrone(dest: AudioNode) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    osc.frequency.value = 55;
    osc.type = 'sine';
    const g = ctx.createGain();
    g.gain.value = 0.04;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    this.active.push(osc, g);
  }

  // Procedural thunder rumble — triggered on demand
  thunder(dest?: AudioNode) {
    const ctx = this.getCtx();
    const target = dest ?? this.master!;
    const bufSize = ctx.sampleRate * 5;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lo = ctx.createBiquadFilter();
    lo.type = 'lowpass';
    lo.frequency.value = 80;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5);

    src.connect(lo);
    lo.connect(g);
    g.connect(target);
    src.start();
  }

  // Load and play cricket recording
  async crickets(dest: AudioNode) {
    const ctx = this.getCtx();
    try {
      const res = await fetch('/audio/weather-vibe/frogs_and_crickets.wav');
      const arrayBuf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      src.connect(g);
      g.connect(dest);
      src.start();
      this.recording = src;
    } catch {
      // File not yet available — no audio for clear-night
    }
  }

  async setState(state: WeatherState) {
    if (state === this.currentState) return;
    this.currentState = state;
    this.stopAll();

    const ctx = this.getCtx();
    const dest = this.master!;

    switch (state) {
      case 'clear-night':
        await this.crickets(dest);
        this.wind(0.2, dest);
        break;
      case 'clear-day':
        this.wind(0.4, dest);
        break;
      case 'partly-cloudy':
        this.wind(0.6, dest);
        break;
      case 'overcast':
        this.wind(0.3, dest);
        break;
      case 'fog':
        this.fogDrone(dest);
        break;
      case 'rain':
        this.rainOnGlass(dest);
        this.wind(0.15, dest);
        break;
      case 'snow':
        this.wind(0.1, dest);
        break;
      case 'storm':
        this.rainOnGlass(dest);
        this.wind(0.5, dest);
        // Thunder scheduled in Storm environment component
        break;
    }
  }

  mute() { if (this.master) this.master.gain.value = 0; }
  unmute() { if (this.master) this.master.gain.value = 0.7; }
  toggle() {
    if (!this.master) return;
    this.master.gain.value = this.master.gain.value > 0 ? 0 : 0.7;
  }
}

export const weatherAudio = new WeatherAudio();
```

- [ ] **Step 2: Wire audio into WeatherVibe root on first interaction**

In `src/experiments/WeatherVibe.tsx`, add:
```tsx
import { useEffect, useRef } from 'react';
import { weatherAudio } from './weather-vibe/audio';

// Inside WeatherVibe component, after weather loads:
const audioStarted = useRef(false);
useEffect(() => {
  if (!weather) return;
  const start = () => {
    if (audioStarted.current) return;
    audioStarted.current = true;
    weatherAudio.setState(weather.state);
  };
  window.addEventListener('click', start, { once: true });
  window.addEventListener('touchstart', start, { once: true });
  return () => {
    window.removeEventListener('click', start);
    window.removeEventListener('touchstart', start);
  };
}, [weather]);
```

- [ ] **Step 3: Add mute toggle to HUD**

In `HUD.tsx`, add a mute button (bottom-center, pointer-events enabled):
```tsx
import { weatherAudio } from './audio';
import { Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';

// Inside HUD component:
const [muted, setMuted] = useState(false);
const toggleMute = () => {
  weatherAudio.toggle();
  setMuted(m => !m);
};

// Add to JSX (pointer-events-auto so it's clickable):
<div className="absolute bottom-5 left-1/2 -translate-x-1/2" style={{ pointerEvents: 'auto' }}>
  <button onClick={toggleMute} style={{ color: accent, opacity: 0.4 }}>
    {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
  </button>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts src/experiments/WeatherVibe.tsx src/experiments/weather-vibe/HUD.tsx
git commit -m "feat: audio manager — procedural synthesis + cricket recording slot + mute toggle"
```

---

## Task 6: ClearDay environment

**Files:**
- Create: `src/experiments/weather-vibe/shaders/atmosphere.frag.glsl`
- Create: `src/experiments/weather-vibe/shaders/atmosphere.vert.glsl`
- Create: `src/experiments/weather-vibe/shaders/heatShimmer.frag.glsl`
- Create: `src/experiments/weather-vibe/environments/ClearDay.tsx`
- Modify: `src/experiments/weather-vibe/Scene.tsx` — add ClearDay to router

- [ ] **Step 1: Atmosphere shader**

Create `src/experiments/weather-vibe/shaders/atmosphere.vert.glsl`:
```glsl
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

Create `src/experiments/weather-vibe/shaders/atmosphere.frag.glsl`:
```glsl
uniform float uTime;
varying vec3 vWorldPos;

void main() {
  vec3 dir = normalize(vWorldPos);
  float elevation = dir.y; // -1 to 1

  // Sky gradient: deep blue at zenith → warm haze at horizon
  vec3 zenith = vec3(0.18, 0.42, 0.82);
  vec3 horizon = vec3(0.95, 0.85, 0.65);
  vec3 ground = vec3(0.55, 0.50, 0.40);

  vec3 sky = mix(horizon, zenith, smoothstep(0.0, 0.6, elevation));
  sky = mix(ground, sky, smoothstep(-0.05, 0.05, elevation));

  // Sun disc
  vec3 sunDir = normalize(vec3(0.3, 0.6, -0.8));
  float sun = dot(dir, sunDir);
  float sunDisc = smoothstep(0.998, 1.0, sun);
  float sunGlow = smoothstep(0.97, 0.998, sun) * 0.3;

  sky += vec3(1.0, 0.98, 0.8) * sunDisc;
  sky += vec3(1.0, 0.7, 0.3) * sunGlow;

  // Lens flare streaks
  float flare = 0.0;
  for (float i = 1.0; i <= 4.0; i++) {
    float streak = smoothstep(0.9992, 0.9995, abs(dot(dir, sunDir + vec3(i * 0.001, 0.0, 0.0))));
    flare += streak * (0.1 / i);
  }
  sky += vec3(1.0, 0.9, 0.6) * flare;

  gl_FragColor = vec4(sky, 1.0);
}
```

- [ ] **Step 2: Heat shimmer shader**

Create `src/experiments/weather-vibe/shaders/heatShimmer.frag.glsl`:
```glsl
uniform float uTime;
uniform sampler2D uScene;
varying vec2 vUv;

void main() {
  float shimmer = sin(vUv.x * 40.0 + uTime * 2.0) * 0.003
                + sin(vUv.y * 30.0 + uTime * 1.5) * 0.002;
  // Only apply near horizon (low vUv.y)
  float mask = smoothstep(0.15, 0.0, vUv.y);
  vec2 uv = vUv + vec2(shimmer * mask, 0.0);
  gl_FragColor = texture2D(uScene, uv);
}
```

- [ ] **Step 3: ClearDay component**

Create `src/experiments/weather-vibe/environments/ClearDay.tsx`:
```tsx
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

  // Very slow tilt — upward over ~90 seconds then back
  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.rotation.x = Math.sin(t * 0.011) * 0.4 - 0.1; // tilt up and back
    camera.rotation.y += 0.00015; // gentle lateral drift
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
```

- [ ] **Step 4: Add ClearDay to Scene router**

In `Scene.tsx`, add:
```tsx
import ClearDay from './environments/ClearDay';

// In Environment switch:
case 'clear-day': return <ClearDay />;
```

- [ ] **Step 5: Test + commit**

```bash
pnpm dev
```

Temporarily force `weather.state = 'clear-day'` in `WeatherVibe.tsx` to test (revert after). You should see a warm atmospheric sky with a sun disc, gentle lens flare, and the camera slowly tilting upward.

```bash
git add src/experiments/weather-vibe/shaders/atmosphere.* src/experiments/weather-vibe/shaders/heatShimmer.* src/experiments/weather-vibe/environments/ClearDay.tsx
git commit -m "feat: clear-day environment — atmosphere shader, sun disc, lens flare"
```

---

## Task 7: Rain environment — wet glass + condensation interaction

This is the most complex task. Take it step by step.

**Files:**
- Create: `src/experiments/weather-vibe/shaders/wetGlass.frag.glsl`
- Create: `src/experiments/weather-vibe/shaders/wetGlass.vert.glsl`
- Create: `src/experiments/weather-vibe/environments/Rain.tsx`
- Modify: `Scene.tsx`

- [ ] **Step 1: Wet glass vertex shader**

Create `src/experiments/weather-vibe/shaders/wetGlass.vert.glsl`:
```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

- [ ] **Step 2: Wet glass fragment shader**

Create `src/experiments/weather-vibe/shaders/wetGlass.frag.glsl`:
```glsl
uniform float uTime;
uniform sampler2D uWorld;   // scene render target
uniform sampler2D uMask;    // condensation mask (white=fogged, black=clear)

varying vec2 vUv;

// Hash for pseudo-random droplet seeds
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  // --- Rain streaks ---
  float streakGrid = floor(uv.x * 40.0);
  float streakSeed = hash(vec2(streakGrid, 0.0));
  float streakSpeed = 0.04 + streakSeed * 0.06;
  float streakY = fract(uv.y + uTime * streakSpeed + streakSeed);
  float streakX = streakGrid / 40.0 + streakSeed * 0.012;
  float streak = smoothstep(0.008, 0.0, abs(uv.x - streakX - 0.003));
  streak *= smoothstep(0.0, 0.05, streakY) * smoothstep(1.0, 0.85, streakY);
  streak *= step(0.5, streakSeed); // only some columns have streaks

  // --- Condensation mask ---
  float condensation = texture2D(uMask, uv).r;

  // --- Refraction (world behind glass) ---
  // Subtle UV distortion from droplets
  vec2 distort = vec2(
    sin(uv.y * 30.0 + uTime * 0.5) * 0.003,
    cos(uv.x * 25.0 + uTime * 0.4) * 0.002
  );
  vec3 world = texture2D(uWorld, uv + distort * (1.0 - condensation)).rgb;

  // --- Glass tint ---
  vec3 glassTint = vec3(0.05, 0.12, 0.18); // deep teal interior

  // --- Fog/condensation blur (approximate with color shift) ---
  vec3 fogColor = mix(glassTint, vec3(0.15, 0.22, 0.28), 0.5);

  // Blend: clear = world, fogged = fogColor
  vec3 color = mix(world, fogColor, condensation * 0.92);

  // Add streak highlights
  color += vec3(0.3, 0.5, 0.6) * streak * condensation * 0.5;
  color += vec3(0.6, 0.8, 1.0) * streak * (1.0 - condensation) * 0.3;

  // Interior ambient light reflection
  color += glassTint * 0.05;

  gl_FragColor = vec4(color, 1.0);
}
```

- [ ] **Step 3: Rain environment component**

Create `src/experiments/weather-vibe/environments/Rain.tsx`:
```tsx
import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import {
  ShaderMaterial, PlaneGeometry, Mesh,
  DataTexture, RGBAFormat, UnsignedByteType,
  Vector2, Scene as ThreeScene, PerspectiveCamera,
  BufferGeometry, BufferAttribute, AdditiveBlending,
} from 'three';
// @ts-ignore
import glassFrag from '../shaders/wetGlass.frag.glsl?raw';
// @ts-ignore
import glassVert from '../shaders/wetGlass.vert.glsl?raw';

const MASK_SIZE = 512;

function RainWorld() {
  // The 3D rain environment visible through the glass
  const particleCount = 3000;
  const pointsRef = useRef<any>(null);

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 60 - 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i] = 0.08 + Math.random() * 0.06;
    }
    return { positions, velocities };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3 + 1] -= velocities[i];
      pos[i * 3]     -= velocities[i] * 0.1; // slight angle
      if (pos[i * 3 + 1] < -10) {
        pos[i * 3 + 1] = 50;
        pos[i * 3]     = (Math.random() - 0.5) * 80;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      <ambientLight intensity={0.1} color="#1A2A3A" />
      <fog attach="fog" args={['#0D1A26', 20, 80]} />
      {/* Ground plane — reflective wet look */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0D1520" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Rain particles */}
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#88AACC"
          size={0.05}
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

export default function Rain() {
  const { gl, camera, size } = useThree();

  // Render world to FBO
  const worldFBO = useFBO(size.width, size.height);

  // Condensation mask — DataTexture we paint into
  const maskData = useMemo(() => new Uint8Array(MASK_SIZE * MASK_SIZE * 4).fill(255), []);
  const maskTex = useMemo(() => {
    const tex = new DataTexture(maskData, MASK_SIZE, MASK_SIZE, RGBAFormat, UnsignedByteType);
    tex.needsUpdate = true;
    return tex;
  }, [maskData]);

  // Glass quad material
  const glassMat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uWorld: { value: worldFBO.texture },
    uMask: { value: maskTex },
  }), [worldFBO, maskTex]);

  // Separate scene for the world behind the glass
  const worldScene = useMemo(() => {
    const s = new ThreeScene();
    return s;
  }, []);

  // Condensation refill per frame (+0.0017 per pixel toward 255)
  useFrame(({ clock, scene }) => {
    if (glassMat.current) glassMat.current.uniforms.uTime.value = clock.getElapsedTime();

    // Refill condensation
    let dirty = false;
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i] < 255) {
        maskData[i] = Math.min(255, maskData[i] + 0.43); // 0.0017 * 255 ≈ 0.43
        maskData[i + 1] = maskData[i];
        maskData[i + 2] = maskData[i];
        maskData[i + 3] = 255;
        dirty = true;
      }
    }
    if (dirty) maskTex.needsUpdate = true;
  });

  // Mouse/touch clearing
  const clearing = useRef(false);

  const clearAt = useCallback((clientX: number, clientY: number) => {
    const u = clientX / window.innerWidth;
    const v = 1 - clientY / window.innerHeight;
    const px = Math.floor(u * MASK_SIZE);
    const py = Math.floor(v * MASK_SIZE);
    const radius = 40;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || nx >= MASK_SIZE || ny < 0 || ny >= MASK_SIZE) continue;
        const idx = (ny * MASK_SIZE + nx) * 4;
        const gaussian = Math.exp(-(dist * dist) / (2 * (radius * 0.4) ** 2));
        maskData[idx] = Math.max(0, maskData[idx] - gaussian * 255);
        maskData[idx + 1] = maskData[idx];
        maskData[idx + 2] = maskData[idx];
        maskData[idx + 3] = 255;
      }
    }
    maskTex.needsUpdate = true;
  }, [maskData, maskTex]);

  useEffect(() => {
    const onDown  = () => { clearing.current = true; };
    const onUp    = () => { clearing.current = false; };
    const onMove  = (e: MouseEvent) => { if (clearing.current) clearAt(e.clientX, e.clientY); };
    const onTouch = (e: TouchEvent) => {
      Array.from(e.touches).forEach(t => clearAt(t.clientX, t.clientY));
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouch);
    };
  }, [clearAt]);

  // Hint animation — automated smear after 8s of no interaction
  const lastInteraction = useRef(Date.now());
  const hintPlayed = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (hintPlayed.current) return;
      if (Date.now() - lastInteraction.current > 8000) {
        hintPlayed.current = true;
        // Draw a slow smear in lower-left corner
        let x = 80, y = window.innerHeight - 120;
        const animate = () => {
          clearAt(x, y);
          x += 2;
          y -= 1;
          if (x < 180) requestAnimationFrame(animate);
        };
        animate();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [clearAt]);

  return (
    <>
      {/* Glass quad — fills screen */}
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={glassMat}
          vertexShader={glassVert}
          fragmentShader={glassFrag}
          uniforms={uniforms}
        />
      </mesh>
      {/* Rain world rendered via a portal — needs weitere setup in Scene.tsx */}
      <RainWorld />
    </>
  );
}
```

- [ ] **Step 4: Add Rain to Scene router**

```tsx
import Rain from './environments/Rain';
// In switch:
case 'rain': return <Rain />;
```

- [ ] **Step 5: Test condensation mechanic**

Force `weather.state = 'rain'`. You should see:
- Fogged glass with rain streaks
- Mouse drag clears the condensation with gaussian softness
- The cleared area slowly re-fogs over ~10 seconds
- Rain particles visible through cleared patches

- [ ] **Step 6: Commit**

```bash
git add src/experiments/weather-vibe/shaders/wetGlass.* src/experiments/weather-vibe/environments/Rain.tsx
git commit -m "feat: rain environment — wet glass shader, condensation mask, mouse/touch clearing, 10s refog"
```

---

## Task 8: Fog environment

**Files:**
- Create: `src/experiments/weather-vibe/shaders/fogMarch.frag.glsl`
- Create: `src/experiments/weather-vibe/environments/Fog.tsx`
- Modify: `Scene.tsx`

- [ ] **Step 1: Fog march fragment shader**

Create `src/experiments/weather-vibe/shaders/fogMarch.frag.glsl`:
```glsl
uniform float uTime;
varying vec2 vUv;

// FBM noise for organic fog shape
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv - 0.5;

  // Fog density varies over time and space
  float density = fbm(vec3(uv * 2.0, uTime * 0.03));
  density = smoothstep(0.3, 0.7, density);

  // Breathing: slow ±10% over 30s cycle
  float breathe = 1.0 + 0.1 * sin(uTime * 0.209); // 2π/30 ≈ 0.209
  density *= breathe;

  vec3 fogColor = mix(vec3(0.75, 0.78, 0.72), vec3(0.88, 0.90, 0.85), density);

  // Vignette at edges
  float vignette = 1.0 - length(uv) * 0.6;
  fogColor *= vignette;

  gl_FragColor = vec4(fogColor, 0.85 * density + 0.3);
}
```

- [ ] **Step 2: Fog component**

Create `src/experiments/weather-vibe/environments/Fog.tsx`:
```tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial } from 'three';
// @ts-ignore
import fogFrag from '../shaders/fogMarch.frag.glsl?raw';

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Procedural tree silhouette — a column of thin boxes
function TreeSilhouette({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, -2, z]} scale={[scale, scale, scale]}>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[0.3, 6, 0.3]} />
        <meshStandardMaterial color="#1A1F18" />
      </mesh>
      {[3, 5, 7].map((h, i) => (
        <mesh key={i} position={[0, h, 0]}>
          <coneGeometry args={[1.5 - i * 0.3, 2, 6]} />
          <meshStandardMaterial color="#151A14" />
        </mesh>
      ))}
    </group>
  );
}

export default function Fog() {
  const matRef = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // Slow forward drift + very subtle footstep bob
  useFrame(({ clock, camera }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    const t = clock.getElapsedTime();
    camera.position.z = -t * 0.3; // slow forward
    camera.position.y = 0.8 + Math.sin(t * 1.2) * 0.012; // footstep bob
  });

  const trees = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      x: (Math.sin(i * 2.3) * 0.5 + 0.5) * 30 - 15,
      z: -10 - i * 8,
      scale: 0.7 + (i % 3) * 0.2,
    })), []);

  return (
    <group>
      <ambientLight intensity={0.3} color="#C8CCBE" />
      <fog attach="fog" args={['#C8CCBE', 5, 40]} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#A8AA9A" />
      </mesh>

      {/* Tree silhouettes */}
      {trees.map((t, i) => <TreeSilhouette key={i} {...t} />)}

      {/* Fog overlay quad */}
      <mesh position={[0, 0, -0.4]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={fogFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 3: Add to Scene router + commit**

```bash
git add src/experiments/weather-vibe/shaders/fogMarch.frag.glsl src/experiments/weather-vibe/environments/Fog.tsx
git commit -m "feat: fog environment — raymarched fog shader, tree silhouettes, slow forward drift"
```

---

## Task 9: Snow environment

**Files:**
- Create: `src/experiments/weather-vibe/environments/Snow.tsx`
- Modify: `Scene.tsx`

- [ ] **Step 1: Snow component**

Create `src/experiments/weather-vibe/environments/Snow.tsx`:
```tsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, BufferAttribute, AdditiveBlending } from 'three';

export default function Snow() {
  const pointsRef = useRef<any>(null);
  const count = 5000;

  const { positions, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      speeds[i] = 0.012 + Math.random() * 0.016;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, offsets };
  }, []);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(({ clock, camera }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= speeds[i];
      pos[i * 3]     += Math.sin(t * 0.3 + offsets[i]) * 0.005; // lateral drift
      if (pos[i * 3 + 1] < -2) {
        pos[i * 3 + 1] = 38;
        pos[i * 3]     = camera.position.x + (Math.random() - 0.5) * 60;
        pos[i * 3 + 2] = camera.position.z + (Math.random() - 0.5) * 60;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    // Slow forward camera drift
    camera.position.z -= 0.008;
    camera.rotation.x = -0.08; // slight downward look
  });

  return (
    <group>
      <ambientLight intensity={0.9} color="#E8EEF4" />
      <fog attach="fog" args={['#E8EEF4', 20, 60]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#D8E4EF" />
      </mesh>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#FFFFFF"
          size={0.08}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
```

- [ ] **Step 2: Add to Scene router + commit**

```bash
git add src/experiments/weather-vibe/environments/Snow.tsx
git commit -m "feat: snow environment — particle system, slow drift, pale silence"
```

---

## Task 10: Storm environment

**Files:**
- Create: `src/experiments/weather-vibe/environments/Storm.tsx`
- Modify: `Scene.tsx`

- [ ] **Step 1: Storm component (extends Rain with lightning)**

Create `src/experiments/weather-vibe/environments/Storm.tsx`:
```tsx
import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import { ShaderMaterial, DataTexture, RGBAFormat, UnsignedByteType, AdditiveBlending, BufferGeometry, BufferAttribute } from 'three';
import { weatherAudio } from '../audio';
// @ts-ignore
import glassFrag from '../shaders/wetGlass.frag.glsl?raw';
// @ts-ignore
import glassVert from '../shaders/wetGlass.vert.glsl?raw';

const MASK_SIZE = 512;

export default function Storm() {
  const { size } = useThree();
  const worldFBO = useFBO(size.width, size.height);

  const maskData = useMemo(() => new Uint8Array(MASK_SIZE * MASK_SIZE * 4).fill(255), []);
  const maskTex = useMemo(() => {
    const tex = new DataTexture(maskData, MASK_SIZE, MASK_SIZE, RGBAFormat, UnsignedByteType);
    tex.needsUpdate = true;
    return tex;
  }, [maskData]);

  const glassMat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uWorld: { value: worldFBO.texture },
    uMask: { value: maskTex },
  }), [worldFBO, maskTex]);

  // Lightning flash state
  const lightning = useRef({ active: false, intensity: 0, nextIn: 15 + Math.random() * 15 });

  // Rain particles
  const pointsRef = useRef<any>(null);
  const count = 5000;
  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 60 - 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i] = 0.12 + Math.random() * 0.08;
    }
    return { positions, velocities };
  }, []);
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions.slice(), 3));
    return geo;
  }, [positions]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (glassMat.current) glassMat.current.uniforms.uTime.value = t;

    // Condensation refill (same 10s rate as rain)
    let dirty = false;
    for (let i = 0; i < maskData.length; i += 4) {
      if (maskData[i] < 255) {
        maskData[i] = Math.min(255, maskData[i] + 0.43);
        maskData[i + 1] = maskData[i];
        maskData[i + 2] = maskData[i];
        maskData[i + 3] = 255;
        dirty = true;
      }
    }
    if (dirty) maskTex.needsUpdate = true;

    // Rain particles
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] -= velocities[i];
        pos[i * 3]     -= velocities[i] * 0.15;
        if (pos[i * 3 + 1] < -10) {
          pos[i * 3 + 1] = 50;
          pos[i * 3]     = (Math.random() - 0.5) * 80;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Lightning
    const L = lightning.current;
    L.nextIn -= delta;
    if (L.nextIn <= 0) {
      L.active = true;
      L.intensity = 0.4 + Math.random() * 0.6;
      L.nextIn = 12 + Math.random() * 18; // 12–30s
      // Trigger thunder after 1–3s delay
      const delay = 1000 + Math.random() * 2000;
      setTimeout(() => weatherAudio.thunder(), delay);
    }
    if (L.active) {
      L.intensity *= 0.85; // fast decay
      if (L.intensity < 0.01) { L.active = false; L.intensity = 0; }
    }
  });

  return (
    <>
      <ambientLight intensity={0.05} color="#050810" />
      <fog attach="fog" args={['#0A0F1E', 15, 60]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#060810" metalness={0.9} roughness={0.1} />
      </mesh>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#6688BB"
          size={0.06}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={glassMat}
          vertexShader={glassVert}
          fragmentShader={glassFrag}
          uniforms={uniforms}
        />
      </mesh>
    </>
  );
}
```

- [ ] **Step 2: Add to Scene router + commit**

```bash
git add src/experiments/weather-vibe/environments/Storm.tsx
git commit -m "feat: storm environment — heavy rain glass, lightning flash, procedural thunder"
```

---

## Task 11: PartlyCloudy + Overcast environments

**Files:**
- Create: `src/experiments/weather-vibe/environments/PartlyCloudy.tsx`
- Create: `src/experiments/weather-vibe/environments/Overcast.tsx`
- Modify: `Scene.tsx`

- [ ] **Step 1: PartlyCloudy**

Create `src/experiments/weather-vibe/environments/PartlyCloudy.tsx`:
```tsx
import { useFrame } from '@react-three/fiber';
import { Cloud, Sky } from '@react-three/drei';

export default function PartlyCloudy() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.04) * 2;
    camera.rotation.x = 0.3 + Math.sin(t * 0.02) * 0.05;
  });

  return (
    <>
      <Sky sunPosition={[100, 40, -100]} turbidity={4} rayleigh={1} />
      <ambientLight intensity={0.7} color="#B8CCE0" />
      <directionalLight position={[50, 80, -50]} intensity={0.8} color="#FFF5E0" />
      <Cloud position={[-20, 25, -60]} speed={0.1} opacity={0.7} segments={12} />
      <Cloud position={[30, 30, -80]} speed={0.08} opacity={0.5} segments={10} />
      <Cloud position={[10, 20, -40]} speed={0.12} opacity={0.4} segments={8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#7A8A6A" />
      </mesh>
      <fog attach="fog" args={['#B0C4D8', 60, 200]} />
    </>
  );
}
```

- [ ] **Step 2: Overcast**

Create `src/experiments/weather-vibe/environments/Overcast.tsx`:
```tsx
import { useFrame } from '@react-three/fiber';

export default function Overcast() {
  useFrame(({ clock, camera }) => {
    camera.position.z = -clock.getElapsedTime() * 0.15;
    camera.position.y = 1.2;
  });

  return (
    <>
      <ambientLight intensity={0.6} color="#9A9E9C" />
      <fog attach="fog" args={['#7A7A7A', 10, 60]} />
      {/* Overcast sky dome */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[500, 32, 32]} />
        <meshBasicMaterial color="#8A8A8A" side={2} />
      </mesh>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#5A5650" />
      </mesh>
    </>
  );
}
```

- [ ] **Step 3: Add both to Scene router**

```tsx
import PartlyCloudy from './environments/PartlyCloudy';
import Overcast from './environments/Overcast';

// In switch:
case 'partly-cloudy': return <PartlyCloudy />;
case 'overcast':      return <Overcast />;
```

- [ ] **Step 4: Commit**

```bash
git add src/experiments/weather-vibe/environments/PartlyCloudy.tsx src/experiments/weather-vibe/environments/Overcast.tsx
git commit -m "feat: partly-cloudy and overcast environments"
```

---

## Task 12: State transitions + explorations entry

**Files:**
- Modify: `src/experiments/WeatherVibe.tsx` — cross-fade on state change
- Modify: `src/data/explorations.ts` — add weather-vibe entry

- [ ] **Step 1: Add cross-fade transition wrapper**

In `WeatherVibe.tsx`, wrap `<Scene>` with a fade:
```tsx
import { AnimatePresence, motion } from 'framer-motion';

// Replace the Scene line with:
<AnimatePresence mode="wait">
  <motion.div
    key={weather.state}
    className="absolute inset-0"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 3, ease: 'easeInOut' }}
  >
    <Scene weather={weather} />
  </motion.div>
</AnimatePresence>
```

- [ ] **Step 2: Add to explorations data**

In `src/data/explorations.ts`, uncomment or add:
```typescript
{
  id: 'weather-vibe',
  name: 'Weather Vibe',
  type: 'Experience',
  tags: ['WebGL', 'Three.js', 'Shaders', 'React'],
  url: '/explorations/weather-vibe',
  description: 'A meditative 3D environment that lives in your local weather.',
},
```

- [ ] **Step 3: Final build check**

```bash
pnpm run build
```

Expected: 0 errors. All 8 environment routes functional.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: weather-vibe complete — transitions, explorations entry, all 8 environments"
```
