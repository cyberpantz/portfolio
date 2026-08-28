# Globe Location Picker — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline city text input in Weather Vibe with a 3D wireframe globe that slides into view, orients to the current location, and lets the user pick a new location by searching or by dragging and clicking the globe surface.

**Architecture:** Separate react-three-fiber `Canvas` rendered as a fixed overlay (`GlobeModal`), isolated from the weather scene's render loop and EffectComposer. The globe mesh is stationary; `OrbitControls` from `@react-three/drei` orbits the camera around it. Location confirmation calls a new `setLocation(lat, lng)` on the weather hook.

**Tech Stack:** `@react-three/fiber`, `@react-three/drei` (OrbitControls), `three`, `framer-motion` — all already installed. Open-Meteo geocoding API + BigDataCloud reverse geocoding — both already used, both free.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/experiments/weather-vibe/GlobeModal.tsx` | **Create** | Overlay shell: backdrop, Canvas, search input, LOCATE button |
| `src/experiments/weather-vibe/GlobeScene.tsx` | **Create** | Three.js content: sphere, pins, OrbitControls, raycaster |
| `src/experiments/weather-vibe/useWeather.ts` | **Modify** | Export `geocodeCity`; add `setLocation(lat, lng)` to hook return |
| `src/experiments/weather-vibe/HUD.tsx` | **Modify** | Replace `onSetCity` prop with `onOpenGlobe`; remove inline edit state |
| `src/experiments/WeatherVibe.tsx` | **Modify** | Add `globeOpen` state; render `<GlobeModal>`; wire `setLocation` |

---

## Component Design

### `GlobeModal.tsx`

Fixed-position overlay rendered in `WeatherVibe.tsx`. Receives:

```ts
interface GlobeModalProps {
  currentLat: number;
  currentLng: number;
  onLocate: (lat: number, lng: number) => void;
  onClose: () => void;
}
```

**Layout (stacked absolutely):**
1. Backdrop `div` — `position: fixed, inset: 0, background: rgba(0,0,0,0.78)`, Framer Motion fade
2. react-three-fiber `Canvas` — centered, `460px × 460px` on desktop, `min(90vw, 90vh)` square on mobile
3. Search `input` — positioned below canvas center, monospace, matches HUD aesthetic
4. `LOCATE` button — appears below search when a new pin is placed, Framer Motion fade-in
5. Close affordance — ESC key and clicking the backdrop close the modal

**Animation:**
- Open: backdrop opacity `0→1` (0.3s ease), canvas wrapper scale `0.88→1` + opacity `0→1` (0.4s spring, stiffness 280, damping 24)
- Close: scale `1→0.88` + opacity `1→0` (0.22s ease-in), backdrop `1→0` (0.28s)
- LOCATE button: opacity `0→1` (0.25s) when `pendingPin` becomes non-null

**Search behavior:**
- `onChange` updates local `query` state
- `onKeyDown Enter`: calls exported `geocodeCity(query)` → on success, sets `pendingPin` lat/lng and calls `animateCameraTo(lat, lng)` (passed down as a ref callback from `GlobeScene`)
- If geocode returns null: input shakes (Framer Motion `x` keyframe `[0, -6, 6, -4, 4, 0]`, 0.3s)
- Placeholder text: `city, region or country...` (monospace, 0.35 opacity)

**LOCATE button:**
- Label: `LOCATE` — monospace uppercase, 11px, letter-spacing 0.2em
- On click: calls `onLocate(pendingPin.lat, pendingPin.lng)`, then triggers close animation
- Style matches HUD button aesthetic (no border, transparent background, subtle text-shadow)

---

### `GlobeScene.tsx`

react-three-fiber scene rendered inside `GlobeModal`'s Canvas. Receives:

```ts
interface GlobeSceneProps {
  currentLat: number;
  currentLng: number;
  onPinDrop: (lat: number, lng: number) => void;         // fires when user clicks globe
  animateCameraToRef: React.MutableRefObject<((lat: number, lng: number) => void) | null>;
}
```

**Camera:** `PerspectiveCamera` at `[0, 0, 5]`, FOV 45.

**Globe mesh:**
```
SphereGeometry(2, 36, 24)
MeshBasicMaterial({ wireframe: true, color: '#ffffff', opacity: 0.18, transparent: true })
```
The sphere is fixed at origin and never rotates. The camera orbits it.

**OrbitControls (Drei):**
- `enableZoom={false}` — no zoom, globe stays the same size
- `enablePan={false}` — no panning
- `autoRotate={false}`
- `rotateSpeed={0.6}`
- `ref` stored to call `setAzimuthalAngle` / `setPolarAngle` for programmatic animation

**Pins:**
```
SphereGeometry(0.038, 8, 8)
MeshBasicMaterial({ color: '#ffffff', opacity: 0.9, transparent: true })
```
- **Current location pin** — always visible, slow pulse (scale `1→1.4→1`, 2s loop via `useFrame`)
- **Pending pin** — brighter (`opacity: 1`), no pulse, appears when user drops or searches

**Lat/lng → 3D position:**
```ts
function latLngToVec3(lat: number, lng: number, r = 2): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}
```

**Click to pin (raycasting):**
- `onClick` handler on the Canvas element (via react-three-fiber's `onPointerDown` on a transparent hit-mesh the same size as the globe)
- `raycaster.setFromCamera(mouse, camera)` → intersect sphere → `intersection.point`
- Reverse lat/lng:
```ts
function vec3ToLatLng(p: THREE.Vector3): { lat: number; lng: number } {
  const r = p.length();
  const lat = 90 - Math.acos(p.y / r) * (180 / Math.PI);
  const lng = (Math.atan2(p.z, -p.x) * (180 / Math.PI)) - 180;
  return { lat, lng: lng < -180 ? lng + 360 : lng };
}
```
- Calls `onPinDrop(lat, lng)` → `GlobeModal` reverse-geocodes via BigDataCloud and populates search field

**Programmatic camera animation (`animateCameraTo`):**
```ts
// Converts lat/lng to OrbitControls spherical angles:
// polar   = angle from Y-axis = PI/2 - lat_rad
// azimuth = angle from Z-axis = -lng_rad
function latLngToAngles(lat: number, lng: number) {
  return {
    polar:   Math.PI / 2 - lat * (Math.PI / 180),
    azimuth: -lng * (Math.PI / 180),
  };
}
```
Animation: lerp current OrbitControls angles toward target over ~0.8s using `useFrame`. When `animateCameraToRef.current` is called, set target angles and start lerp.

**Lighting:** none needed — `MeshBasicMaterial` is unlit.

**Background:** transparent (`gl={{ alpha: true, antialias: true }}`). The dark backdrop behind it is the `GlobeModal` backdrop `div`.

---

### `useWeather.ts` changes

**Export `geocodeCity`:**
```ts
export async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; name: string; population?: number } | null>
```
No logic change — just add `export`.

**Add `setLocation` to hook:**
```ts
interface UseWeatherResult {
  weather: WeatherData | null;
  status: Status;
  setCity: (city: string) => Promise<void>;
  setLocation: (lat: number, lng: number) => Promise<void>; // new
}
```
Implementation inside `useWeather`:
```ts
const setLocation = useCallback(async (lat: number, lng: number) => {
  setStatus('fetching');
  try {
    coordsRef.current = { latitude: lat, longitude: lng };
    const result = await fetchWeatherData(lat, lng);
    writeCache(result);
    setWeather(result);
    setStatus('ready');
  } catch {
    setStatus('ready');
  }
}, []);
```

---

### `HUD.tsx` changes

- Remove `onSetCity` prop, `editState` state, `input` state, `inputRef`, all editing-related handlers
- Add `onOpenGlobe: () => void` prop
- City name element: `onClick={() => onOpenGlobe()}`, same styling as current `city-trigger`, cursor pointer
- Remove `.city-input` and `.city-hint` CSS and JSX

---

### `WeatherVibe.tsx` changes

```tsx
const { weather, status, setCity, setLocation } = useWeather();
const [globeOpen, setGlobeOpen] = useState(false);

// In JSX:
<HUD weather={weather} status={status} onOpenGlobe={() => setGlobeOpen(true)} />

<AnimatePresence>
  {globeOpen && weather && (
    <GlobeModal
      currentLat={weather.latitude}
      currentLng={weather.longitude}
      onLocate={async (lat, lng) => {
        setGlobeOpen(false);
        await setLocation(lat, lng);
      }}
      onClose={() => setGlobeOpen(false)}
    />
  )}
</AnimatePresence>
```

---

## Reverse Geocoding on Pin Drop

When user clicks the globe surface, `GlobeModal` fetches:
```
GET https://api.bigdatacloud.net/data/reverse-geocode-client
  ?latitude={lat}&longitude={lng}&localityLanguage=en
```
Uses `geo.locality ?? geo.city ?? 'Unknown location'` as display name in the search field. Failure is silent — search field shows `lat, lng` formatted to 2 decimal places as fallback.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Geocode returns null | Search input shakes, no pin change |
| Reverse geocode fails | Search field shows `{lat.toFixed(2)}, {lng.toFixed(2)}` |
| `setLocation` fetch fails | Globe closes, weather status resets to `ready`, no scene change |
| ESC key | Globe closes with no location change |
| Backdrop click | Globe closes with no location change |

---

## Aesthetic Notes

- All text inside the modal: `font-family: monospace`, matching the HUD
- Colors: white (`#ffffff`) at various opacities — no palette-tinted colors on the globe itself (it reads clean against any weather backdrop)
- Search input border: `1px solid rgba(255,255,255,0.25)`, focus: `rgba(255,255,255,0.6)`
- No drop shadows on globe elements — the wireframe is light enough to float on its own
- Pin uses no icon — just the small sphere geometry. Minimalism.

---

## Out of Scope (v1)

- Country/region labels on the globe
- Animating a flight path arc between old and new pin
- Multiple saved locations
- Mobile drag-to-rotate fine-tuning (basic OrbitControls touch support is automatic)
- Aurora visualizer integration (separate spec)
- Internet radio integration (separate spec)
