import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Camera } from 'three';

// Gentle parallax pan. Mouse/keys tilt the camera by a fixed bounded offset —
// NOT a continuous rotation. Achieved by applying only the DELTA each frame
// so the camera drifts to a position and stays there, rather than spinning.

const MOUSE_STRENGTH = 4;   // max degrees of offset from mouse edge-to-edge
const KEY_STRENGTH   = 8;   // max degrees from a held key
const SMOOTH         = 0.05;
const MAX_X_RAD      = 0.35; // hard clamp ~20° — world can never flip

export function usePan() {
  const mouseTarget = useRef({ x: 0, y: 0 });
  const keysHeld    = useRef<Set<string>>(new Set());
  const smooth      = useRef({ x: 0, y: 0 });
  const applied     = useRef({ x: 0, y: 0 }); // what we've already baked in

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseTarget.current.x =  ((e.clientX / window.innerWidth)  - 0.5) * 2;
      mouseTarget.current.y = -((e.clientY / window.innerHeight) - 0.5) * 2;
    };
    const onDown = (e: KeyboardEvent) => keysHeld.current.add(e.key);
    const onUp   = (e: KeyboardEvent) => keysHeld.current.delete(e.key);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown',   onDown);
    window.addEventListener('keyup',     onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown',   onDown);
      window.removeEventListener('keyup',     onUp);
    };
  }, []);

  useFrame(({ camera }: { camera: Camera }) => {
    // Key influence
    let kx = 0, ky = 0;
    const k = keysHeld.current;
    if (k.has('ArrowLeft')  || k.has('a') || k.has('A')) kx -= 1;
    if (k.has('ArrowRight') || k.has('d') || k.has('D')) kx += 1;
    if (k.has('ArrowUp')    || k.has('w') || k.has('W')) ky += 1;
    if (k.has('ArrowDown')  || k.has('s') || k.has('S')) ky -= 1;

    // Target in degrees
    const tx = mouseTarget.current.x * MOUSE_STRENGTH + kx * KEY_STRENGTH;
    const ty = mouseTarget.current.y * MOUSE_STRENGTH + ky * KEY_STRENGTH;

    // Smooth toward target
    smooth.current.x += (tx - smooth.current.x) * SMOOTH;
    smooth.current.y += (ty - smooth.current.y) * SMOOTH;

    // Apply only the DELTA since last frame so the camera drifts to a position
    // and stops — not a continuous spin.
    const dx = (smooth.current.x - applied.current.x) * (Math.PI / 180);
    const dy = (smooth.current.y - applied.current.y) * (Math.PI / 180);
    applied.current.x = smooth.current.x;
    applied.current.y = smooth.current.y;

    camera.rotation.y += dx;

    // Hard clamp on x — physically impossible to flip the world
    camera.rotation.x = Math.max(
      -MAX_X_RAD,
      Math.min(MAX_X_RAD, camera.rotation.x + dy),
    );
  });
}
