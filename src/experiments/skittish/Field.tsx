/**
 * The cat, drawn.
 *
 * ── What is no longer here ──────────────────────────────────────────────
 *
 * The flat version carried a GPGPU simulation: two render targets, a
 * ping-pong, per-particle velocity integrated every frame. None of that
 * survives, because none of it is needed. With the sit baked in and the
 * motion coming from twenty joints, a point's position is a pure function
 * of its rest position and the bone matrices — there is no state to keep.
 * The whole thing is one draw call.
 *
 * ── Solid, not luminous ─────────────────────────────────────────────────
 *
 * Points are opaque and depth-tested, and lit from their own normals. That
 * is what makes a turning head legible: the far ear goes behind the skull
 * instead of shining through it, and the lit side moves as the head moves.
 * The additive glow the flat field used cannot show either.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchMesh, scatter, type Cloud } from './loader';
import { Cat, JOINTS, type Pose } from './behaviour';

const CAM_FOV = 34;

/* The cat fills roughly a unit cube, and the camera sits off to one side so
   it is seen at three-quarters rather than in profile. Strict profile is
   the pose in which a head turn is least readable — it can only shorten. */
const CAM_DIR = new THREE.Vector3(0.62, 0.22, 1).normalize();
const CAM_DIST = 3.05;

/** Ambient floor, so the shadowed side is dark but not empty. */
const AMBIENT = 0.22;

const VERT = /* glsl */ `
  attribute vec3 aNormal;
  attribute vec4 aJoint;
  attribute vec4 aWeight;

  uniform sampler2D uBones;   // one mat4 per joint, four texels each
  uniform float uBoneCount;
  uniform float uSize;
  uniform float uScale;

  varying float vShade;

  /* A joint matrix, read as four texels. Nearest-filtered and sampled at
     texel centres, or a matrix would come back as a blend of two joints. */
  mat4 boneAt(float i) {
    float w = uBoneCount * 4.0;
    float x = i * 4.0;
    return mat4(
      texture2D(uBones, vec2((x + 0.5) / w, 0.5)),
      texture2D(uBones, vec2((x + 1.5) / w, 0.5)),
      texture2D(uBones, vec2((x + 2.5) / w, 0.5)),
      texture2D(uBones, vec2((x + 3.5) / w, 0.5))
    );
  }

  void main() {
    vec4 rest = vec4(position, 1.0);
    vec4 skinned = vec4(0.0);
    vec3 n = vec3(0.0);
    float total = 0.0;

    for (int i = 0; i < 4; i++) {
      float w = aWeight[i];
      if (w <= 0.0) continue;
      mat4 M = boneAt(aJoint[i]);
      skinned += w * (M * rest);
      n += w * (mat3(M) * aNormal);
      total += w;
    }

    /*
     * Points the moving bones do not touch keep their baked place.
     *
     * Most of the animal is frozen — the haunches, the hind legs, the far
     * foreleg — and those arrive with weights summing to zero. Without this
     * they would collapse to the origin, which is a very fast way to lose
     * four fifths of a cat.
     */
    vec3 p = total > 0.001 ? skinned.xyz / total : position;
    vec3 nn = total > 0.001 ? normalize(n) : aNormal;

    vec3 light = normalize(vec3(-0.35, 0.78, 0.52));
    vShade = ${AMBIENT.toFixed(2)} + ${(1 - AMBIENT).toFixed(2)} * max(dot(nn, light), 0.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / max(0.25, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uInk;
  varying float vShade;

  void main() {
    /* Round, with a hard edge. Soft-edged points need blending, blending
       needs sorting, and sorting a hundred thousand points every frame is
       how you turn a cat into a slideshow. A disc and a depth test give
       the same look for nothing. */
    vec2 d = gl_PointCoord - 0.5;
    if (dot(d, d) > 0.25) discard;
    gl_FragColor = vec4(uInk * vShade, 1.0);
  }
`;

/**
 * Compose the pose into one matrix per joint.
 *
 * Rotations are world-axis, about each joint's own pivot, and composed
 * parent-first down the chain — so the ears inherit the head, the head
 * inherits the neck, and the whole neck inherits the chest breathing.
 * Every matrix is the identity at rest, which is what lets the baked sit
 * be the zero of the system.
 */
function composePose(pose: Pose, out: Float32Array): void {
  const world: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  const pivot = new THREE.Vector3();
  const toOrigin = new THREE.Matrix4();
  const back = new THREE.Matrix4();

  for (let i = 0; i < JOINTS.length; i++) {
    const j = JOINTS[i];
    const r = pose.get(i);
    if (r) {
      pivot.set(j.at[0], j.at[1], j.at[2]);
      e.set(r[0], r[1], r[2], 'XYZ');
      q.setFromEuler(e);
      m.makeRotationFromQuaternion(q);
      toOrigin.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
      back.makeTranslation(pivot.x, pivot.y, pivot.z);
      m.premultiply(back).multiply(toOrigin);
    } else {
      m.identity();
    }
    world[i] = j.parent >= 0 ? new THREE.Matrix4().multiplyMatrices(world[j.parent], m) : m.clone();
    world[i].toArray(out, i * 16);
  }
}

type Ptr = { x: number; y: number; z: number; present: boolean };

function Cloud3D({ cloud, ptr }: { cloud: Cloud; ptr: React.MutableRefObject<Ptr> }) {
  const group = useRef<THREE.Points>(null);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const cat = useMemo(() => new Cat(), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cloud.pos, 3));
    g.setAttribute('aNormal', new THREE.BufferAttribute(cloud.nrm, 3));
    g.setAttribute('aJoint', new THREE.BufferAttribute(cloud.idx, 4));
    g.setAttribute('aWeight', new THREE.BufferAttribute(cloud.wgt, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    return g;
  }, [cloud]);

  /*
   * Bone matrices go through a texture, not a uniform array.
   *
   * GLSL ES 1.00 forbids indexing a uniform array by a varying value, and
   * a point's joint index is exactly that. A texture can be sampled at any
   * coordinate, which is why every engine that skins on the GPU ends up
   * here. Twenty joints is eighty texels.
   */
  const boneData = useMemo(() => new Float32Array(JOINTS.length * 16), []);
  const boneTex = useMemo(() => {
    const t = new THREE.DataTexture(boneData, JOINTS.length * 4, 1, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [boneData]);

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uBones: { value: boneTex },
        uBoneCount: { value: JOINTS.length },
        uSize: { value: 2.4 },
        uScale: { value: 1 },
        uInk: { value: new THREE.Color('#ded9d0') },
      },
    }),
    [boneTex]
  );

  useEffect(() => () => { geometry.dispose(); material.dispose(); boneTex.dispose(); }, [geometry, material, boneTex]);

  /*
   * The pointer, unprojected onto the plane through the cat that faces the
   * camera.
   *
   * Not the floor and not the screen: a plane at the cat's own depth,
   * perpendicular to the view. Moving the cursor left then genuinely moves
   * along the cat's length AND across its width, because the camera is at
   * an angle — which is what gives the head something to turn toward
   * rather than merely tip at.
   */
  useEffect(() => {
    const el = gl.domElement;
    const ndc = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      camera.getWorldDirection(normal);
      plane.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(0, 0, 0));
      if (ray.ray.intersectPlane(plane, hit)) {
        ptr.current = { x: hit.x, y: hit.y, z: hit.z, present: true };
      }
    };
    const leave = () => { ptr.current.present = false; };

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

  useFrame((state, delta) => {
    /* A backgrounded tab returns with a delta of seconds. Nothing here is
       integrated, so it cannot explode — but the cat would teleport, and a
       clamp is cheaper than explaining that. */
    const dt = Math.min(delta, 1 / 20);
    const { pose, facing } = cat.update(dt, ptr.current);
    composePose(pose, boneData);
    boneTex.needsUpdate = true;
    /*
     * The heading is an object rotation, not a bone.
     *
     * Turning the whole animal is not a joint doing anything — every bone
     * keeps its pose and the thing they belong to swings round. Trying to
     * express it as a root bone would mean re-baking with the pelvis
     * unfrozen, for a transform three.js already applies for free.
     */
    if (group.current) group.current.rotation.y = facing;
    material.uniforms.uScale.value = (gl.getPixelRatio() * state.size.height) / 700;
  });

  return <points ref={group} geometry={geometry} material={material} frustumCulled={false} />;
}

/**
 * The laser dot.
 *
 * The cursor is hidden and this stands in for it, which does more than
 * amuse: a red dot on a wall is a thing a cat demonstrably chases, so the
 * whole interaction explains itself before anyone reads a caption. An arrow
 * pointer explains nothing.
 *
 * ── Why this is a quad and not a point ──────────────────────────────────
 *
 * It was a point sprite, and it vanished in places. Two reasons, both
 * intrinsic to point sprites and neither fixable by tuning:
 *
 *   · gl_PointSize is capped by the driver — ALIASED_POINT_SIZE_RANGE is
 *     63 or 64 on a great many GPUs. A dot sized for a retina display asks
 *     for about 67, and behaviour past the cap is undefined: some drivers
 *     clamp, some drop the primitive outright.
 *   · a point is culled on its CENTRE. Near an edge the whole sprite
 *     disappears while half of it should still be on screen, which reads
 *     as dead zones around the border.
 *
 * A quad turned to face the camera has neither limit, and costs two
 * triangles.
 */
function Laser({ at }: { at: React.MutableRefObject<{ x: number; y: number; z: number; present: boolean }> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const mat = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        precision mediump float;
        uniform float uT;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          if (d > 1.0) discard;
          /* A hot core inside a wide soft halo, which is what a laser on a
             surface looks like — not a flat disc. The core flickers very
             slightly, the way a cheap diode does. */
          float core = smoothstep(0.30, 0.0, d) * (0.93 + 0.07 * sin(uT * 47.0));
          float halo = smoothstep(1.0, 0.14, d) * 0.45;
          vec3 tint = mix(vec3(1.0, 0.13, 0.10), vec3(1.0, 0.78, 0.74), core);
          gl_FragColor = vec4(tint, clamp(core + halo, 0.0, 1.0));
        }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    []
  );
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame(({ clock, camera }) => {
    if (!mesh.current) return;
    const p = at.current;
    mesh.current.visible = p.present;
    if (!p.present) return;

    const t = clock.elapsedTime;
    /* A hand holding a laser is never quite still, and a perfectly steady
       dot reads as a UI element rather than as something being held. */
    const shake = 0.004;
    mesh.current.position.set(
      p.x + Math.sin(t * 23.1) * shake,
      p.y + Math.sin(t * 19.7 + 1.3) * shake,
      p.z,
    );
    /* Billboard, and scale with distance so the dot holds a constant size
       on screen however the camera is framed. */
    mesh.current.quaternion.copy(camera.quaternion);
    const d = mesh.current.position.distanceTo(camera.position);
    mesh.current.scale.setScalar(d * 0.055);
    mat.uniforms.uT.value = t;
  });

  return <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />;
}

function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const dist = CAM_DIST / Math.min(1, aspect * 0.85);
    cam.position.copy(CAM_DIR).multiplyScalar(dist);
    cam.lookAt(0, 0.02, 0);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export default function Field({ meshUrl, onReady }: { meshUrl: string; onReady?: () => void }) {
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  /* One pointer, shared: the cat aims at it and the laser is drawn at it,
     so they can never disagree about where it is. */
  const ptr = useRef<Ptr>({ x: 0, y: 0, z: 0, present: false });

  useEffect(() => {
    let live = true;
    (async () => {
      const mesh = await fetchMesh(meshUrl);
      /* Point count by device. This is the whole reason the mesh ships
         rather than a baked cloud. */
      const wide = window.innerWidth;
      const count = wide < 700 ? 45000 : wide < 1400 ? 110000 : 170000;
      const c = scatter(mesh, count);
      if (!live) return;
      setCloud(c);
      ready.current?.();
    })();
    return () => { live = false; };
  }, [meshUrl]);

  if (!cloud) return null;
  return (
    <Canvas
      camera={{ position: [2, 0.7, 3], fov: CAM_FOV }}
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    >
      <Rig />
      <Cloud3D cloud={cloud} ptr={ptr} />
      <Laser at={ptr} />
    </Canvas>
  );
}
