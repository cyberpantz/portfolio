/**
 * What the cat does: breathe, watch you, and swat at your cursor.
 *
 * Everything here produces joint rotations. The skeleton, the skinning and
 * the drawing know nothing about pointers; this file knows nothing about
 * matrices. The seam is a pose.
 */

import rig from './cat-rig.json';

const DEG = Math.PI / 180;
export const JOINTS = rig.joints as { name: string; at: [number, number, number]; parent: number }[];
/**
 * The point the cat sits on, in mesh space.
 *
 * The seat, not the origin and not the centroid — measured at bake time as
 * the centre of the contact patch. Rotating anywhere else makes the animal
 * orbit rather than turn.
 */
export const PIVOT = rig.pivot as [number, number, number];
export const JOINT = Object.fromEntries(JOINTS.map((j, i) => [j.name, i])) as Record<string, number>;

/** Euler triple per joint index. Absent joints stay at rest. */
export type Pose = Map<number, [number, number, number]>;

export const TUNING = {
  /* How far the head will go before it stops looking like a head. Yaw is
     generous because a cat really does turn nearly side-on; pitch is not,
     because a cat lifts its chin far less than it feels like it does. */
  yawMax: 62 * DEG,
  pitchMax: 26 * DEG,

  /*
   * How the turn is shared out along the neck.
   *
   * All of it at the skull is a bobblehead. Spread evenly and the cat looks
   * boneless. A real turn is mostly skull with the last two neck joints
   * contributing a little, which also means the throat follows rather than
   * creasing.
   */
  chain: [
    ['RigNeck3', 0.12],
    ['RigNeck4', 0.2],
    ['RigHead', 0.68],
  ] as [string, number][],

  /*
   * Watching, not tracking.
   *
   * A cat holds still, then commits. `notice` is how far the pointer must
   * move before it re-aims at all, and `settle` how long it must stay there
   * first. The stillness between is what reads as attention — a head glued
   * to the cursor is a servo.
   */
  notice: 0.09,
  settle: 0.1,
  turn: 0.19,

  /* The paw. Range is where a bat is worth it; reach is how far the swipe
     goes; commit is how long it holds before returning. */
  pawRange: 0.55,
  pawSwipe: 0.42,
  pawEvery: [0.55, 1.5] as [number, number],

  /*
   * When the body gives up and turns.
   *
   * A cat aims in three stages: eyes, then head, then body. The head takes
   * every small correction, and the body only commits once the head has
   * run out of neck. `bodyAt` is where that happens — past this much yaw
   * the shoulders come round and the head un-cranes as they do.
   *
   * Slower than the head by a wide margin, because turning a whole animal
   * is a decision and turning a head is a glance.
   */
  bodyAt: 38 * DEG,
  bodyTurn: 0.62,
  bodyNotice: 14 * DEG,

  /*
   * How much of a turn the shoulders take before the hips do.
   *
   * A rigid rotation of the whole animal reads as a lazy susan: nothing
   * about the cat is turning, the ground under it is. What a real turn
   * looks like is a twist — the chest leads, the hindquarters follow a beat
   * later, and for a moment the animal is not straight.
   *
   * So the chest carries the difference between where the shoulders are
   * pointed and where the hips have got to, clamped. `twistMax` is what a
   * spine will actually do; beyond it the cat becomes a corkscrew.
   */
  twistMax: 22 * DEG,
  hipLag: 1.15,

  /*
   * Crouching at something on the floor.
   *
   * The cat sits with its feet at about y = −0.78. `crouchFrom` is where
   * the pointer stops being overhead and starts being prey; `crouchAt` is
   * where the crouch is total. Between them it ramps, so lowering the
   * laser toward the ground pulls the cat down with it rather than
   * tripping a switch.
   *
   * `crouchMax` is the chest drop. Most of it is given back along the neck
   * (`crouchLevel`) — a stalking cat's body goes down while its head stays
   * up and forward, and cancelling only part of the drop is what makes the
   * head follow the shoulders a little instead of floating.
   */
  crouchFrom: -0.32,
  crouchAt: -0.66,
  crouchMax: 17 * DEG,
  crouchLevel: 0.78,
  crouchEase: 0.34,

  /* Breath, at rest and when the cat is interested. A watching cat holds
     its breath a little. */
  breathe: 1.9 * DEG,
  breathHz: 0.29,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const add = (p: Pose, j: number, r: [number, number, number]) => {
  const cur = p.get(j);
  if (cur) { cur[0] += r[0]; cur[1] += r[1]; cur[2] += r[2]; } else p.set(j, [...r]);
};

/**
 * Where the pointer is, in the cat's own space.
 *
 * A real 3D point, not screen coordinates. The camera views the cat at an
 * angle, so a cursor moving left across the screen moves both along the
 * cat's length and across its width, and only an unprojected point carries
 * that. Given a flat x/y the head could pitch but never genuinely turn,
 * which is the whole reason this stopped being a 2D piece.
 */
export type Sense = {
  x: number;
  y: number;
  z: number;
  /** False when the pointer has left, which sends the cat back to rest. */
  present: boolean;
};

/**
 * The cat, one frame at a time.
 *
 * Deliberately a class with its own clock rather than a pure function of
 * time: a cat's decisions depend on what it decided last — whether it has
 * already noticed you, whether a paw is already mid-swipe — and threading
 * that through a signature would be worse than holding it.
 */
export class Cat {
  private t = 0;
  private aim = { yaw: 0, pitch: 0 };
  private want = { yaw: 0, pitch: 0 };
  private seen = { x: 0, y: 0, has: false };
  private dwell = 0;
  private interest = 0;

  /** 0 at rest, 1 at full stretch, and the phase of the current swipe. */
  /** Which way the whole animal is facing, and where it wants to face. */
  private body = 0;
  private shoulders = 0;
  private bodyWant = 0;

  /** 0 sitting up, 1 flattened over something on the floor. */
  private crouch = 0;

  private paw = 0;
  private swiping = false;
  private swipeT = 0;
  private nextSwipe = 0;

  /** The body's heading, in radians about the world up axis. */
  get facing(): number {
    return this.body;
  }

  update(dt: number, world: Sense): { pose: Pose; facing: number } {
    this.t += dt;
    const pose: Pose = new Map();

    /*
     * Everything below works in the cat's own frame.
     *
     * The body turns, so a pointer that has not moved in the world HAS
     * moved relative to the cat. Doing the head and paw maths in world
     * space would make the cat chase its own rotation — it turns toward
     * the laser, which then appears to have shifted, so it turns again.
     */
    const s = this.toLocal(world);

    /* ---- deciding where to look -------------------------------------- */
    if (s.present) {
      const moved = this.seen.has ? Math.hypot(s.x - this.seen.x, s.y - this.seen.y) : Infinity;
      this.dwell = moved > TUNING.notice ? this.dwell + dt : 0;
      if (this.dwell > TUNING.settle) {
        this.dwell = 0;
        this.seen = { x: s.x, y: s.y, has: true };

        /*
         * The cat sits facing +x, up is +y. Yaw turns it about the world
         * up axis; pitch tips it about the sideways one.
         *
         * The sign on yaw is not cosmetic: rotating about +y takes +x
         * toward −z, so aiming at a target on +z needs a negative angle.
         * Getting it backwards gives a cat that pointedly looks away from
         * the cursor, which is funny once.
         *
         * Measured from the head rather than the origin, or the cat aims
         * past anything close to it.
         */
        const head = JOINTS[JOINT.RigHead].at;
        const dx = s.x - head[0], dy = s.y - head[1], dz = s.z - head[2];
        const wanted = -Math.atan2(dz, dx);
        this.want.yaw = clamp(wanted, -TUNING.yawMax, TUNING.yawMax);
        this.want.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -TUNING.pitchMax, TUNING.pitchMax);

        /*
         * Hand the overflow to the body.
         *
         * Whatever the neck cannot cover becomes a heading change, and
         * only past `bodyNotice` — otherwise the cat creeps round by a
         * degree at a time and never stops moving.
         */
        const overflow = wanted - this.want.yaw;
        if (Math.abs(overflow) > TUNING.bodyNotice || Math.abs(wanted) > TUNING.bodyAt) {
          this.bodyWant = this.body + overflow;
        }
      }
      this.interest += (1 - this.interest) * Math.min(1, dt * 2.5);
    } else {
      this.dwell = 0;
      this.seen.has = false;
      this.want.yaw = 0;
      this.want.pitch = 0;
      this.interest += (0 - this.interest) * Math.min(1, dt * 0.8);
    }

    const k = 1 - Math.exp(-dt / TUNING.turn);
    this.aim.yaw += (this.want.yaw - this.aim.yaw) * k;
    this.aim.pitch += (this.want.pitch - this.aim.pitch) * k;

    /*
     * The body follows, slowly, and the head gives back what it borrowed.
     *
     * As the shoulders come round, the angle the neck has to hold shrinks
     * — which happens for free, because the head's target is recomputed in
     * the cat's own frame each time it re-aims. The head leads and then
     * relaxes, which is the shape of the real movement.
     */
    /*
     * Shoulders first, hips after.
     *
     * `shoulders` chases the target at the body's own pace; `body` — the
     * hips, and the thing the whole object rotates by — chases the
     * shoulders more slowly still. The gap between them is the twist, and
     * the twist is what makes it a cat turning rather than a plinth.
     */
    const bk = 1 - Math.exp(-dt / TUNING.bodyTurn);
    this.shoulders += (this.bodyWant - this.shoulders) * bk;
    const hk = 1 - Math.exp(-dt / (TUNING.bodyTurn * TUNING.hipLag));
    this.body += (this.shoulders - this.body) * hk;

    /* ---- the crouch --------------------------------------------------- */
    /*
     * Driven by the pointer's height, not by distance.
     *
     * A laser on the wall is something to watch; a laser on the floor is
     * something to catch, and the cat's whole shape changes when it
     * decides which it is looking at. Losing the pointer releases it.
     */
    const wantCrouch = s.present
      ? clamp(
          (TUNING.crouchFrom - s.y) / (TUNING.crouchFrom - TUNING.crouchAt),
          0,
          1
        )
      : 0;
    this.crouch += (wantCrouch - this.crouch) * (1 - Math.exp(-dt / TUNING.crouchEase));
    const drop = this.crouch * TUNING.crouchMax;

    for (const [name, share] of TUNING.chain) {
      const j = JOINT[name];
      if (j === undefined) continue;
      add(pose, j, [0, 0, 0]);
      const p = pose.get(j)!;
      /* These are WORLD-axis rotations about the joint's pivot, not
         bone-local ones. The bones were authored with arbitrary local
         orientations — one ear's local y is not the other's — and posing
         in world axes means this file never has to know. */
      p[1] += this.aim.yaw * share;
      p[2] += this.aim.pitch * share;
      /* Giving back most of what the chest just took. The shares sum to
         one, so spreading the counter by share unbends the neck evenly
         instead of kinking it at the skull. */
      p[2] += drop * TUNING.crouchLevel * share;
    }

    /* ---- breath, and the twist ---------------------------------------- */
    const chest = JOINT.RigChest;
    if (chest !== undefined) {
      /* The spine taking up the slack between shoulders and hips. Because
         the neck hangs off the chest, the head comes round with it for
         free — which is the order a cat actually does this in. */
      const twist = clamp(this.shoulders - this.body, -TUNING.twistMax, TUNING.twistMax);
      add(pose, chest, [0, twist, -drop]);
    }
    if (chest !== undefined) {
      /* Shallower when it is paying attention, which is what a cat that has
         noticed something actually does. */
      const depth = TUNING.breathe * (1 - 0.45 * this.interest);
      add(pose, chest, [0, 0, depth * Math.sin(this.t * Math.PI * 2 * TUNING.breathHz)]);
    }

    /* ---- the tail ---------------------------------------------------- */
    this.tail(pose);

    /* ---- the paw ----------------------------------------------------- */
    this.bat(dt, s, pose);

    return { pose, facing: this.body };
  }

  /**
   * World pointer into the cat's frame.
   *
   * The SHOULDERS' heading, not the hips'. Everything above the chest —
   * neck, head, ears — hangs off the chest bone, so that is the frame they
   * are actually posed in. Using the hips would make the head fight the
   * twist and lag by exactly the amount the spine is taking up.
   */
  private toLocal(w: Sense): Sense {
    const c = Math.cos(-this.shoulders), sn = Math.sin(-this.shoulders);
    /* Rotation about the world up axis: x and z turn, y is untouched. */
    return {
      x: w.x * c + w.z * sn,
      y: w.y,
      z: -w.x * sn + w.z * c,
      present: w.present,
    };
  }

  /**
   * A travelling wave down the tail.
   *
   * Each joint lags the one before it, so a slow sweep at the root arrives
   * at the tip late and larger. In phase, the whole tail hinges like a
   * lever and looks like a rudder rather than an animal.
   */
  private tail(pose: Pose): void {
    const names = ['RigTail1', 'RigTail2', 'RigTail3', 'RigTail4', 'RigTail5', 'RigTail6'];
    /* A restless tail when the cat is interested, a drifting one when not.
       This is the tell people read first, before the head. */
    const amp = (1.1 + 3.4 * this.interest) * DEG * (1 + 1.4 * this.crouch);
    const speed = (0.5 + 1.5 * this.interest) * (1 + 0.9 * this.crouch);
    names.forEach((n, i) => {
      const j = JOINT[n];
      if (j === undefined) return;
      const lag = i * 0.55;
      const grow = 0.6 + i * 0.28;
      add(pose, j, [
        0,
        amp * grow * Math.sin(this.t * speed - lag),
        amp * grow * 0.5 * Math.sin(this.t * speed * 0.63 - lag * 0.8),
      ]);
    });
  }

  /**
   * Swat at the pointer when it comes near the paw.
   *
   * Fast out, slower back, and a cooldown afterwards — a cat does not
   * paddle continuously at a thing, it takes a swipe and reassesses. The
   * asymmetry is most of the gesture: symmetric in and out reads as a
   * mechanism.
   */
  private bat(dt: number, s: Sense, pose: Pose): void {
    const ankle = JOINTS[JOINT.RigLFLegAnkle]?.at;
    const near = s.present && ankle
      ? Math.hypot(s.x - ankle[0], s.y - ankle[1], s.z - ankle[2]) < TUNING.pawRange
      : false;

    if (this.swiping) {
      this.swipeT += dt;
      const total = TUNING.pawEvery[0];
      const f = this.swipeT / total;
      /* Out in the first third, back over the remaining two. */
      this.paw = f < 0.33
        ? Math.sin((f / 0.33) * Math.PI * 0.5)
        : Math.cos(((f - 0.33) / 0.67) * Math.PI * 0.5);
      if (f >= 1) { this.swiping = false; this.paw = 0; this.nextSwipe = this.t + 0.5 + Math.random() * 1.4; }
    } else if (near && this.t > this.nextSwipe) {
      this.swiping = true;
      this.swipeT = 0;
    } else {
      this.paw += (0 - this.paw) * Math.min(1, dt * 4);
    }

    if (this.paw <= 0.001) return;
    /* Shoulder leads, elbow follows, wrist last — the whip that makes a
       swipe look like one rather than a door opening. */
    const chain: [string, number][] = [
      ['RigLFLeg1', 0.5], ['RigLFLeg2', 0.85], ['RigLFLeg3', 0.55], ['RigLFLegAnkle', 0.3],
    ];
    for (const [name, gain] of chain) {
      const j = JOINT[name];
      if (j === undefined) continue;
      add(pose, j, [0, 0, -this.paw * TUNING.pawSwipe * gain]);
    }
  }
}
