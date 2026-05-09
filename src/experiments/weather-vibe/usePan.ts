import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Camera } from 'three';

// Gentle parallax pan driven by mouse position and arrow/WASD keys.
// Target offset is smoothed toward with a low-pass filter so motion feels
// floaty and organic rather than snappy.
//
// Scene useFrame calls can continue to set their own camera drift — this
// hook adds on top of whatever base position each scene sets.

const MOUSE_STRENGTH  = 0.8;   // max degrees of tilt from mouse
const KEY_STRENGTH    = 1.2;   // max degrees of tilt from held key
const SMOOTH          = 0.06;  // lerp factor per frame (lower = slower/floatier)

export function usePan() {
  const mouseTarget = useRef({ x: 0, y: 0 });
  const keyTarget   = useRef({ x: 0, y: 0 });
  const current     = useRef({ x: 0, y: 0 });
  const keysHeld    = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Normalise to -1..1 from screen centre
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
    // Accumulate key influence
    let kx = 0, ky = 0;
    const k = keysHeld.current;
    if (k.has('ArrowLeft')  || k.has('a') || k.has('A')) kx -= 1;
    if (k.has('ArrowRight') || k.has('d') || k.has('D')) kx += 1;
    if (k.has('ArrowUp')    || k.has('w') || k.has('W')) ky += 1;
    if (k.has('ArrowDown')  || k.has('s') || k.has('S')) ky -= 1;
    keyTarget.current.x = kx;
    keyTarget.current.y = ky;

    // Combined target
    const tx = mouseTarget.current.x * MOUSE_STRENGTH + keyTarget.current.x * KEY_STRENGTH;
    const ty = mouseTarget.current.y * MOUSE_STRENGTH + keyTarget.current.y * KEY_STRENGTH;

    // Low-pass smooth
    current.current.x += (tx - current.current.x) * SMOOTH;
    current.current.y += (ty - current.current.y) * SMOOTH;

    // Add to whatever rotation the scene already set this frame
    camera.rotation.y += current.current.x * (Math.PI / 180);
    camera.rotation.x += current.current.y * (Math.PI / 180);
  });
}
