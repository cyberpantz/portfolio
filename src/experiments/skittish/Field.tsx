/**
 * The cat, drawn.
 *
 * ── What is no longer here ──────────────────────────────────────────────
 *
 * The flat version carried a GPGPU simulation: two render targets, a
 * ping-pong, per-particle velocity integrated every frame. None of that
 * survives, because none of it is needed. A point's position is a pure
 * function of its bind position and the bone matrices — there is no state
 * to keep. The whole thing is one draw call.
 *
 * The version after that baked a sitting pose into the geometry and left
 * twenty bones free. That was cheaper still and quietly ruled out every
 * animation in the pack: the legs, spine and pelvis were frozen, so a
 * crouch could only be faked by bowing the chest, and the boundary between
 * moving and frozen vertices tore open whenever the cat turned. What ships
 * now is the whole skeleton and real clips.
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
import { fetchRigBuffer, scatter, type Cloud } from './loader';
import { parseRig, sampleClip, blendPose, composeWorld, subtrees, turnSubtree, skinMatrices, type Rig as CatRig } from './rig';
import { Cat, BONE } from './behaviour';
import { CAM_FOV, CAM_DIR, CAM_DIST, CAM_LOOK, planeNormal } from './stage';

/* Read once, not per frame: the head's index never changes, and the frame
   loop should not be doing dictionary lookups. */
const BONE_HEAD = BONE.RigHead;
const BONE_PAW = BONE.RigLFLegAnkle;

const ORIGIN = new THREE.Vector3(0, 0, 0);


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
  varying float vFacing;

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
     * Every vertex carries weight now, but the guard stays.
     *
     * A point whose weights summed to zero would collapse to the origin,
     * which is a very fast way to lose a cat. The bake asserts this cannot
     * happen; four instructions is a cheap price for it never being able
     * to happen silently.
     */
    vec3 p = total > 0.001 ? skinned.xyz / total : position;
    vec3 nn = total > 0.001 ? normalize(n) : aNormal;

    vec3 light = normalize(vec3(-0.35, 0.78, 0.52));
    vShade = ${AMBIENT.toFixed(2)} + ${(1 - AMBIENT).toFixed(2)} * max(dot(nn, light), 0.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    /*
     * Which way this bit of surface is turned, relative to the viewer.
     *
     * A cloud sampled from a closed surface has two shells — the near side
     * and the far side — and points are not a surface, so the near one
     * does not cover the far one. The gaps between points at the back of
     * the skull are wider than the points themselves, and what shows
     * through them is the cat's own face. Depth testing cannot help: every
     * one of those far points is genuinely visible through a hole.
     *
     * So the far shell is not drawn at all. That is what a solid object
     * does, and it is the difference between a cloud shaped like a cat and
     * a cat made of points.
     */
    vFacing = dot(normalize(normalMatrix * nn), normalize(-mv.xyz));

    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / max(0.25, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uInk;
  varying float vShade;
  varying float vFacing;

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

type Ptr = { x: number; y: number; z: number; present: boolean };

function Cloud3D({ rig, cloud, ptr }: { rig: CatRig; cloud: Cloud; ptr: React.MutableRefObject<Ptr> }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Points>(null);
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
   * here. Forty-four bones is a hundred and seventy-six texels.
   */
  const boneData = useMemo(() => new Float32Array(rig.bones * 16), [rig]);
  const boneTex = useMemo(() => {
    const t = new THREE.DataTexture(boneData, rig.bones * 4, 1, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }, [boneData, rig]);

  /* Scratch for the frame, allocated once. A per-frame allocation of this
     size is how a smooth animation acquires a stutter every few seconds. */
  const work = useMemo(() => ({
    q: new Float32Array(rig.bones * 4),
    t: new Float32Array(3),
    q2: new Float32Array(rig.bones * 4),
    t2: new Float32Array(3),
    world: new Float32Array(rig.bones * 16),
    kids: subtrees(rig),
    head: [0, 0.5, 0] as [number, number, number],
    paw: [0.9, -0.76, -0.09] as [number, number, number],
  }), [rig]);

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uBones: { value: boneTex },
        uBoneCount: { value: rig.bones },
        uSize: { value: 2.4 },
        uScale: { value: 1 },
        uInk: { value: new THREE.Color('#ded9d0') },
      },
    }),
    [boneTex, rig]
  );

  useEffect(() => () => { geometry.dispose(); material.dispose(); boneTex.dispose(); }, [geometry, material, boneTex]);

  /*
   * The pointer, unprojected onto a plane through the cat.
   *
   * Neither the screen nor the floor but tilted between them, so moving
   * the cursor up the frame sends the laser up AND away, and down sends it
   * down and toward the viewer. That is what makes the vertical half of
   * the pointer's travel mean something: it is depth as well as height,
   * and depth is what the cat turns for.
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
      /* Tip the plane's normal up toward vertical, which lays the plane
         itself down toward the floor by the same angle. */
      const n = planeNormal([normal.x, normal.y, normal.z]);
      plane.setFromNormalAndCoplanarPoint(normal.set(n[0], n[1], n[2]), ORIGIN);
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

    /*
     * The cat decides first, using where its head was LAST frame.
     *
     * It has to be one or the other: the head's position comes out of the
     * pose, and which pose to play is what the cat is deciding. A frame of
     * lag on a number that moves at most a few hundredths of a unit per
     * frame is invisible; the alternative is composing the skeleton twice.
     */
    const drive = cat.update(dt, ptr.current, work.head, work.paw);

    const a = rig.clips.get(drive.clip);
    if (!a) return;
    sampleClip(rig, a, drive.time, work.q, work.t);
    const b = drive.from ? rig.clips.get(drive.from) : null;
    if (b && drive.blend < 1) {
      sampleClip(rig, b, drive.fromTime, work.q2, work.t2);
      /* Blending TOWARD the outgoing clip by (1 - blend): at blend 0 the
         result is the old pose exactly, which is what makes the first
         frame of a transition continuous with the last frame before it. */
      blendPose(rig.bones, work.q, work.t, work.q2, work.t2, 1 - drive.blend);
    }

    composeWorld(rig, work.q, work.t, work.world);
    for (const turn of drive.turns) {
      turnSubtree(rig, work.world, work.kids, turn.joint, turn.yaw, turn.pitch);
    }

    const h = BONE_HEAD * 16;
    work.head[0] = work.world[h + 3];
    work.head[1] = work.world[h + 7];
    work.head[2] = work.world[h + 11];
    const w = BONE_PAW * 16;
    work.paw[0] = work.world[w + 3];
    work.paw[1] = work.world[w + 7];
    work.paw[2] = work.world[w + 11];

    skinMatrices(rig, work.world, boneData);
    boneTex.needsUpdate = true;

    /*
     * The heading is an object rotation, about the cat's contact patch.
     *
     * Turning the whole animal is not a joint doing anything — every bone
     * keeps its pose and the thing they belong to swings round. But the
     * mesh's origin is the centre of a bounding box, about a fifth of a
     * body-length behind where the cat is actually resting, so rotating
     * there swings it through an arc: a lazy susan. The pivot comes from
     * the clip and moves as the cat rises, because a sitting cat turns on
     * its haunches and a crouched one on all four feet.
     */
    if (group.current && inner.current) {
      group.current.rotation.y = drive.facing;
      group.current.position.set(drive.pivot[0], 0, drive.pivot[2]);
      inner.current.position.set(-drive.pivot[0], 0, -drive.pivot[2]);
    }
    material.uniforms.uScale.value = (gl.getPixelRatio() * state.size.height) / 700;
  });

  return (
    <group ref={group}>
      <points ref={inner} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
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
    cam.position.set(CAM_DIR[0], CAM_DIR[1], CAM_DIR[2]).multiplyScalar(dist);
    /* Aim slightly above the middle, so the cat sits low in frame with
       headroom rather than centred like a specimen. */
    cam.lookAt(CAM_LOOK[0], CAM_LOOK[1], CAM_LOOK[2]);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export default function Field({ meshUrl, onReady }: { meshUrl: string; onReady?: () => void }) {
  const [loaded, setLoaded] = useState<{ rig: CatRig; cloud: Cloud } | null>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  /* One pointer, shared: the cat aims at it and the laser is drawn at it,
     so they can never disagree about where it is. */
  const ptr = useRef<Ptr>({ x: 0, y: 0, z: 0, present: false });

  useEffect(() => {
    let live = true;
    (async () => {
      const rig = parseRig(await fetchRigBuffer(meshUrl));
      /* Point count by device. This is the whole reason the mesh ships
         rather than a baked cloud. */
      const wide = window.innerWidth;
      const count = wide < 700 ? 45000 : wide < 1400 ? 110000 : 170000;
      const cloud = scatter(rig.mesh, count);
      if (!live) return;
      setLoaded({ rig, cloud });
      ready.current?.();
    })();
    return () => { live = false; };
  }, [meshUrl]);

  if (!loaded) return null;
  return (
    <Canvas
      camera={{ position: [2, 0.7, 3], fov: CAM_FOV }}
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    >
      <Rig />
      <Cloud3D rig={loaded.rig} cloud={loaded.cloud} ptr={ptr} />
      <Laser at={ptr} />
    </Canvas>
  );
}
