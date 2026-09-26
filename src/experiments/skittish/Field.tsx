/**
 * The simulation, ping-ponged across two render targets.
 *
 * One pass per frame: a fullscreen quad reads the current state texture,
 * integrates every particle, and writes the next one. A shader cannot read
 * the target it is writing, hence two of them and a swap.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PARAMS, SIM_VERT, SIM_FRAG, DRAW_VERT, DRAW_FRAG } from './sim';
import { loadMask, samplePoints, fitTo, shuffle } from './silhouette';

/** How hard the field is being stirred, 0..1. The audio listens to this. */
export type Stir = { energy: number };

const CAM_FOV = 45;
/** Half-height of the cat in field units, plus breathing room. */
const FIT = 1.15;

function makeTarget(n: number) {
  return new THREE.WebGLRenderTarget(n, n, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    /* Nearest, always. This texture is a record of N discrete particles,
       not a picture — interpolating between two texels invents a particle
       that is the average of two unrelated ones, which shows as a faint
       smear pulling the field toward its own centre. */
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

/**
 * Keep the whole cat in frame at any aspect ratio.
 *
 * A fixed camera distance frames correctly in one shape of window and crops
 * the ears or the tail in every other. Pulling back by whichever of width or
 * height is tighter costs one line and removes a whole class of "it looks
 * wrong on my monitor".
 */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const halfFov = (CAM_FOV / 2) * (Math.PI / 180);
    const aspect = size.width / size.height;
    cam.position.z = FIT / (Math.tan(halfFov) * Math.min(1, aspect));
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function Sim({
  homes, seeds, n, stir,
}: {
  homes: Float32Array;
  seeds: Float32Array;
  n: number;
  stir: React.MutableRefObject<Stir>;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const count = n * n;

  /* Where each particle belongs, plus its size and shade jitter. Uploaded
     once and never touched again. */
  const homeTex = useMemo(() => {
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = homes[i * 2];
      data[i * 4 + 1] = homes[i * 2 + 1];
      data[i * 4 + 2] = seeds[i * 2];
      data[i * 4 + 3] = seeds[i * 2 + 1];
    }
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    return t;
  }, [homes, seeds, n, count]);

  /*
   * The opening state: everywhere but home.
   *
   * Particles start scattered across a ring wider than the cat and are drawn
   * in by the same spring that later brings them back from the pointer. The
   * coalescing at load and the settling after a swipe are not two behaviours
   * — they are one behaviour seen twice, which is why this needs no separate
   * intro animation.
   */
  const initTex = useMemo(() => {
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.1 + Math.random() * 1.5;
      data[i * 4] = Math.cos(a) * r - homes[i * 2];
      data[i * 4 + 1] = Math.sin(a) * r - homes[i * 2 + 1];
    }
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    return t;
  }, [homes, n, count]);

  const targets = useMemo(() => [makeTarget(n), makeTarget(n)] as const, [n]);
  const front = useRef(0);
  const seeded = useRef(false);

  const simMat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: SIM_VERT,
      fragmentShader: SIM_FRAG,
      uniforms: {
        uState: { value: initTex as THREE.Texture },
        uHome: { value: homeTex },
        uPointer: { value: new THREE.Vector2(999, 999) },
        uPointerOn: { value: 0 },
        uTime: { value: 0 },
        uDt: { value: 1 / 60 },
        uStiff: { value: PARAMS.stiffness },
        uDamp: { value: PARAMS.damping },
        uBreeze: { value: PARAMS.breeze },
        uBreezeSpeed: { value: PARAMS.breezeSpeed },
        uRadius: { value: PARAMS.radius },
        uPush: { value: PARAMS.push },
      },
    }),
    [homeTex, initTex]
  );

  const simScene = useMemo(() => {
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat));
    return s;
  }, [simMat]);
  const simCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  /* One vertex per particle, carrying only its address in the state
     texture. Everything else about it is looked up there. */
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const refs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      refs[i * 2] = ((i % n) + 0.5) / n;
      refs[i * 2 + 1] = (Math.floor(i / n) + 0.5) / n;
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));
    return g;
  }, [count, n]);

  const drawMat = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: DRAW_VERT,
      fragmentShader: DRAW_FRAG,
      uniforms: {
        uState: { value: initTex as THREE.Texture },
        uHome: { value: homeTex },
        uTime: { value: 0 },
        uSize: { value: PARAMS.size },
        uWave: { value: PARAMS.wave },
        uWaveSpeed: { value: PARAMS.waveSpeed },
        uScale: { value: 1 },
        uInk: { value: new THREE.Color('#e8e8e0') },
        uAlpha: { value: 0.72 },
      },
      transparent: true,
      depthWrite: false,
      /* Additive, so overlapping particles build light rather than fighting
         over who is in front. At this density a depth-sorted alpha blend
         would flicker as the sort order churned. */
      blending: THREE.AdditiveBlending,
    }),
    [homeTex, initTex]
  );

  useEffect(() => () => {
    targets.forEach((t) => t.dispose());
    homeTex.dispose(); initTex.dispose();
    simMat.dispose(); drawMat.dispose(); geometry.dispose();
  }, [targets, homeTex, initTex, simMat, drawMat, geometry]);

  /*
   * Pointer, in field units.
   *
   * The sheet sits on z=0 and the camera looks straight down -Z, so the
   * visible half-height there is tan(fov/2)·distance and the mapping is two
   * multiplications. Unprojecting a ray would give the same answer after
   * considerably more ceremony.
   *
   * Speed is tracked as well as position, because "being stirred" is about
   * movement: a pointer resting on the cat is not disturbing it, and the
   * purr should not respond to a parked cursor.
   */
  const speed = useRef(0);
  useEffect(() => {
    const el = gl.domElement;
    let lx = 0, ly = 0, has = false;

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const halfH = Math.tan((CAM_FOV / 2) * (Math.PI / 180)) * camera.position.z;
      const halfW = halfH * (r.width / r.height);
      const x = (((e.clientX - r.left) / r.width) * 2 - 1) * halfW;
      const y = (1 - ((e.clientY - r.top) / r.height) * 2) * halfH;
      if (has) speed.current = Math.min(1, Math.hypot(x - lx, y - ly) * 9);
      lx = x; ly = y; has = true;
      (simMat.uniforms.uPointer.value as THREE.Vector2).set(x, y);
      simMat.uniforms.uPointerOn.value = 1;
    };
    const leave = () => { simMat.uniforms.uPointerOn.value = 0; has = false; speed.current = 0; };

    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerdown', move, { passive: true });
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointercancel', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointercancel', leave);
    };
  }, [gl, simMat, camera]);

  useFrame((state, delta) => {
    /*
     * Clamped, and it matters.
     *
     * Explicit integration with a spring is stable only while the step is
     * small. A backgrounded tab returns with a delta of several seconds,
     * which takes it past the point where each frame overshoots further
     * than the last — the field detonates instead of settling.
     */
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;

    const src = seeded.current ? targets[front.current].texture : (initTex as THREE.Texture);
    const dst = targets[1 - front.current];

    simMat.uniforms.uState.value = src;
    simMat.uniforms.uTime.value = t;
    simMat.uniforms.uDt.value = dt;

    const prev = gl.getRenderTarget();
    gl.setRenderTarget(dst);
    gl.render(simScene, simCam);
    gl.setRenderTarget(prev);

    front.current = 1 - front.current;
    seeded.current = true;

    drawMat.uniforms.uState.value = targets[front.current].texture;
    drawMat.uniforms.uTime.value = t;
    /* Point size is in device pixels, so without this the field is half as
       dense on a retina display as on a laptop screen. */
    drawMat.uniforms.uScale.value = (gl.getPixelRatio() * state.size.height) / 720;

    /* Energy for the audio. Approximated from the pointer rather than read
       back from the state texture, because reading a render target stalls
       the pipeline every frame to ask the GPU a question it has already
       answered on screen. Decays fast enough to follow a hand, slowly
       enough not to chatter. */
    const target = simMat.uniforms.uPointerOn.value ? speed.current : 0;
    const k = Math.min(1, dt * (target > stir.current.energy ? 7 : 1.6));
    stir.current.energy += (target - stir.current.energy) * k;
    speed.current *= Math.max(0, 1 - dt * 4);
  });

  return <points geometry={geometry} material={drawMat} frustumCulled={false} />;
}

export default function Field({
  maskUrl, stir, onReady,
}: {
  maskUrl: string;
  stir: React.MutableRefObject<Stir>;
  onReady?: () => void;
}) {
  const [data, setData] = useState<{ homes: Float32Array; seeds: Float32Array; n: number } | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let live = true;
    (async () => {
      const { alpha, w, h } = await loadMask(maskUrl);
      /* A texture edge, so the count is n² by construction. Smaller on small
         screens: a phone has neither the fill rate nor the pixels to show a
         hundred thousand of anything. */
      const n = window.innerWidth < 720 ? 192 : 320;
      const count = n * n;
      const homes = fitTo(shuffle(samplePoints(alpha, w, h, count)), count);
      const seeds = new Float32Array(count * 2);
      for (let i = 0; i < count * 2; i++) seeds[i] = Math.random();
      if (!live) return;
      setData({ homes, seeds, n });
      ready.current?.();
    })();
    return () => { live = false; };
  }, [maskUrl]);

  if (!data) return null;
  return (
    <Canvas
      camera={{ position: [0, 0, 2.6], fov: CAM_FOV }}
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    >
      <FitCamera />
      <Sim homes={data.homes} seeds={data.seeds} n={data.n} stir={stir} />
    </Canvas>
  );
}
