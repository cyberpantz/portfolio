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
import { ANATOMY, headWeight, pawWeight, inFront } from './anatomy';

/** How hard the field is being stirred, 0..1. The audio listens to this. */
export type Stir = { energy: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const smooth01 = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Shortest signed angle, so the paw never swings the long way round. */
const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

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
  homes, n, stir,
}: {
  homes: Float32Array;
  n: number;
  stir: React.MutableRefObject<Stir>;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const count = n * n;

  /* Where each particle belongs, and how much of it is head and how much is
     paw. Uploaded once and never touched again — the pose is applied in the
     shader, so nothing about a particle's membership ever changes.
     Size and shade jitter moved to a hash of the particle's address, which
     freed these two channels for something that could not be derived. */
  const homeTex = useMemo(() => {
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const x = homes[i * 2], y = homes[i * 2 + 1];
      data[i * 4] = x;
      data[i * 4 + 1] = y;
      data[i * 4 + 2] = headWeight(y);
      data[i * 4 + 3] = pawWeight(x, y);
    }
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    return t;
  }, [homes, n, count]);

  /*
   * The opening state: a single point.
   *
   * Every particle starts at the origin — offset is exactly minus its home,
   * so position is zero for all of them — and the cat scales out of that
   * point. Not a collapse inward, which announces the shape before it
   * arrives; an emergence, which does not.
   *
   * There is no separate intro animation. The bloom moves the spring's
   * TARGET outward and the same spring that later chases the cat's head
   * chases that. One mechanism, three jobs.
   */
  const initTex = useMemo(() => {
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = -homes[i * 2];
      data[i * 4 + 1] = -homes[i * 2 + 1];
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
        uTime: { value: 0 },
        uDt: { value: 1 / 60 },
        uStiff: { value: PARAMS.stiffness },
        uDamp: { value: PARAMS.damping },
        uBreeze: { value: PARAMS.breeze },
        uBreezeSpeed: { value: PARAMS.breezeSpeed },
        uNeck: { value: new THREE.Vector2(ANATOMY.neck.x, ANATOMY.neck.y) },
        uElbow: { value: new THREE.Vector2(ANATOMY.elbow.x, ANATOMY.elbow.y) },
        uHeadCx: { value: ANATOMY.headCx },
        uHeadR: { value: ANATOMY.headR },
        uYaw: { value: 0 },
        uNod: { value: 0 },
        uPaw: { value: 0 },
        uBloom: { value: 0 },
        uBloomStagger: { value: PARAMS.bloomStagger },
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
        uNeck: { value: new THREE.Vector2(ANATOMY.neck.x, ANATOMY.neck.y) },
        uElbow: { value: new THREE.Vector2(ANATOMY.elbow.x, ANATOMY.elbow.y) },
        uHeadCx: { value: ANATOMY.headCx },
        uHeadR: { value: ANATOMY.headR },
        uYaw: { value: 0 },
        uNod: { value: 0 },
        uPaw: { value: 0 },
        uBloom: { value: 0 },
        uBloomStagger: { value: PARAMS.bloomStagger },
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
   * The pointer is recorded, not acted on.
   *
   * Nothing here drives the cat directly. The frame loop decides whether
   * what the pointer is doing is worth noticing, and that separation is the
   * whole of the stealth: a handler that set the pose on every move would
   * produce a head glued to the cursor, which is a servo, not an animal.
   */
  const ptr = useRef({ x: 0, y: 0, on: false });
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      /* The sheet is on z=0 and the camera looks straight down -Z, so the
         visible half-height there is tan(fov/2)·distance and the mapping is
         two multiplications. Unprojecting a ray gives the same answer after
         considerably more ceremony. */
      const halfH = Math.tan((CAM_FOV / 2) * (Math.PI / 180)) * camera.position.z;
      const halfW = halfH * (r.width / r.height);
      ptr.current.x = (((e.clientX - r.left) / r.width) * 2 - 1) * halfW;
      ptr.current.y = (1 - ((e.clientY - r.top) / r.height) * 2) * halfH;
      ptr.current.on = true;
    };
    const leave = () => { ptr.current.on = false; };
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
  }, [gl, camera]);

  /* What the cat has decided to look at, and where it has got to so far. */
  const want = useRef({ yaw: 0, nod: 0, paw: 0 });
  const have = useRef({ yaw: 0, nod: 0, paw: 0 });
  const seen = useRef({ x: -99, y: -99 });
  const settling = useRef(0);
  const bloom = useRef(0);

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

    /* ---- the bloom, once ------------------------------------------- */
    bloom.current = Math.min(1, bloom.current + dt / PARAMS.bloom);
    simMat.uniforms.uBloom.value = bloom.current;
    drawMat.uniforms.uBloom.value = bloom.current;

    /* ---- deciding whether to look ---------------------------------- */
    const p = ptr.current;
    if (p.on) {
      /*
       * A cat does not track. It notices, holds, and then commits.
       *
       * So the aim only updates once the pointer has moved further than
       * `notice` from wherever it was last worth looking at, and then only
       * after `noticeDelay` of it staying there. Between those, the head
       * is perfectly still — which is the part that reads as watching
       * rather than following.
       */
      const moved = Math.hypot(p.x - seen.current.x, p.y - seen.current.y);
      if (moved > PARAMS.notice) settling.current += dt;
      else settling.current = 0;

      if (settling.current > PARAMS.noticeDelay) {
        settling.current = 0;
        seen.current = { x: p.x, y: p.y };

        const front = inFront(p.x, p.y);

        /* Nod: turn the head in-plane until its muzzle — which points along
           -X — is aimed at the pointer. */
        const nod = Math.atan2(-(p.y - ANATOMY.neck.y), -(p.x - ANATOMY.neck.x));
        want.current.nod = clamp(nod, -PARAMS.nodMax, PARAMS.nodMax) * front;

        /* Yaw: the nearer the pointer comes to being beside the cat rather
           than in front of it, the more the head has to turn out of profile
           toward the viewer. */
        const closeness = clamp01((p.x + 1.25) / 1.05);
        want.current.yaw = closeness * PARAMS.yawMax * front;

        /* Paw: only if the pointer is close enough to be worth it. */
        const reach = 1 - smooth01(PARAMS.pawRange * 0.55, PARAMS.pawRange,
          Math.hypot(p.x - ANATOMY.paw.x, p.y - ANATOMY.paw.y));
        const rest = Math.atan2(ANATOMY.paw.y - ANATOMY.elbow.y, ANATOMY.paw.x - ANATOMY.elbow.x);
        const to = Math.atan2(p.y - ANATOMY.elbow.y, p.x - ANATOMY.elbow.x);
        want.current.paw = clamp(wrapPi(to - rest), -PARAMS.pawMax, PARAMS.pawMax) * reach * front;
      }
    } else {
      /* Pointer gone: back to rest, at the same unhurried pace. */
      settling.current = 0;
      seen.current = { x: -99, y: -99 };
      want.current = { yaw: 0, nod: 0, paw: 0 };
    }

    /* ---- getting there --------------------------------------------- */
    const k = 1 - Math.exp(-dt / PARAMS.ease);
    const kp = 1 - Math.exp(-dt / PARAMS.pawEase);
    have.current.yaw += (want.current.yaw - have.current.yaw) * k;
    have.current.nod += (want.current.nod - have.current.nod) * k;
    have.current.paw += (want.current.paw - have.current.paw) * kp;

    for (const m of [simMat, drawMat]) {
      m.uniforms.uYaw.value = have.current.yaw;
      m.uniforms.uNod.value = have.current.nod;
      m.uniforms.uPaw.value = have.current.paw;
    }

    /*
     * The purr follows attention, not agitation.
     *
     * A cat purrs because you are near it and it does not mind, which is a
     * different signal from the field being stirred. So the energy is how
     * much the cat is currently engaged with the pointer — in front of it,
     * and being looked at — rather than how hard anything is moving.
     */
    const engaged = p.on ? inFront(p.x, p.y) : 0;
    stir.current.energy += (engaged - stir.current.energy) * Math.min(1, dt * 1.4);
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
  const [data, setData] = useState<{ homes: Float32Array; n: number } | null>(null);
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
      if (!live) return;
      setData({ homes, n });
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
      <Sim homes={data.homes} n={data.n} stir={stir} />
    </Canvas>
  );
}
