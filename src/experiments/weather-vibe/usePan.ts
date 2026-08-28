import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Camera, PerspectiveCamera } from 'three';
import { readAudioLevels } from './audioLevels';

// Gentle parallax pan. Mouse/keys tilt the camera by a fixed bounded offset —
// NOT a continuous rotation. Achieved by applying only the DELTA each frame
// so the camera drifts to a position and stays there, rather than spinning.
//
// Scroll wheel (or two-finger swipe) translates the camera forward/backward
// along its view axis, capped at 15 units inward. Same delta approach so it
// cooperates with per-environment camera animations.

const MOUSE_STRENGTH = 4;   // max degrees of offset from mouse edge-to-edge
const KEY_STRENGTH   = 8;   // max degrees from a held key
const SMOOTH         = 0.05;
const MAX_X_RAD      = 0.35; // hard clamp ~20° — world can never flip
const Z_SMOOTH       = 0.04;
const Z_MAX_IN       = 15;   // max units forward the viewer can travel

// Audio breath: the low end widens the lens by at most a degree. Deliberately
// below the threshold where you would call it an effect — you read it as the
// scene being alive rather than as the camera doing something. Anything past
// about 1.5° starts to look like a zoom and fights the parallax.
const FOV_BREATH = 1.3;
const FOV_SMOOTH = 0.06;

export function usePan() {
  const mouseTarget = useRef({ x: 0, y: 0 });
  const keysHeld    = useRef<Set<string>>(new Set());
  const smooth      = useRef({ x: 0, y: 0 });
  const applied     = useRef({ x: 0, y: 0 }); // what we've already baked in

  // Depth (z-axis) scroll state
  const zTarget  = useRef(0);
  const zSmooth  = useRef(0);
  const zApplied = useRef(0);

  // Resting field of view, captured once so the breath is always measured
  // from the camera's own configured lens rather than from last frame.
  const baseFov = useRef<number | null>(null);
  const stillCamera = useRef(false);

  useEffect(() => {
    stillCamera.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseTarget.current.x =  ((e.clientX / window.innerWidth)  - 0.5) * 2;
      mouseTarget.current.y = -((e.clientY / window.innerHeight) - 0.5) * 2;
    };
    const onDown  = (e: KeyboardEvent) => keysHeld.current.add(e.key);
    const onUp    = (e: KeyboardEvent) => keysHeld.current.delete(e.key);
    const onWheel = (e: WheelEvent) => {
      // Scroll down → move forward (decrease z toward -Z_MAX_IN)
      zTarget.current = Math.max(-Z_MAX_IN, Math.min(0, zTarget.current - e.deltaY * 0.03));
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown',   onDown);
    window.addEventListener('keyup',     onUp);
    window.addEventListener('wheel',     onWheel, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown',   onDown);
      window.removeEventListener('keyup',     onUp);
      window.removeEventListener('wheel',     onWheel);
    };
  }, []);

  useFrame(({ camera }: { camera: Camera }) => {
    // ── Rotation (existing) ──────────────────────────────────────────────────
    let kx = 0, ky = 0;
    const k = keysHeld.current;
    if (k.has('ArrowLeft')  || k.has('a') || k.has('A')) kx -= 1;
    if (k.has('ArrowRight') || k.has('d') || k.has('D')) kx += 1;
    if (k.has('ArrowUp')    || k.has('w') || k.has('W')) ky += 1;
    if (k.has('ArrowDown')  || k.has('s') || k.has('S')) ky -= 1;

    const tx = mouseTarget.current.x * MOUSE_STRENGTH + kx * KEY_STRENGTH;
    const ty = mouseTarget.current.y * MOUSE_STRENGTH + ky * KEY_STRENGTH;

    smooth.current.x += (tx - smooth.current.x) * SMOOTH;
    smooth.current.y += (ty - smooth.current.y) * SMOOTH;

    const dx = (smooth.current.x - applied.current.x) * (Math.PI / 180);
    const dy = (smooth.current.y - applied.current.y) * (Math.PI / 180);
    applied.current.x = smooth.current.x;
    applied.current.y = smooth.current.y;

    camera.rotation.y += dx;
    camera.rotation.x = Math.max(
      -MAX_X_RAD,
      Math.min(MAX_X_RAD, camera.rotation.x + dy),
    );

    // ── Depth (scroll) ────────────────────────────────────────────────────────
    zSmooth.current  += (zTarget.current - zSmooth.current) * Z_SMOOTH;
    const dz = zSmooth.current - zApplied.current;
    zApplied.current  = zSmooth.current;
    camera.position.z += dz;

    // ── Audio breath ─────────────────────────────────────────────────────────
    // FOV rather than position, so this stays completely independent of the
    // delta bookkeeping above and of the per-environment camera animations.
    const cam = camera as PerspectiveCamera;
    if (!stillCamera.current && cam.isPerspectiveCamera) {
      if (baseFov.current === null) baseFov.current = cam.fov;
      const { bass } = readAudioLevels();
      const target = baseFov.current + bass * FOV_BREATH;
      cam.fov += (target - cam.fov) * FOV_SMOOTH;
      cam.updateProjectionMatrix();
    }
  });
}
