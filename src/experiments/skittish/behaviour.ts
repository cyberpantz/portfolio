/**
 * What the cat decides to do.
 *
 * Two layers, and the split matters. Underneath is a clip: sitting,
 * getting up, creeping, sitting back down, taking a swipe — all animation
 * somebody authored, played and cross-faded. On top are a handful of
 * world-axis turns that aim the head, twist the spine and switch the tail,
 * because no clip knows where the laser is.
 *
 * This file emits both and applies neither. It knows nothing about
 * matrices, bones or three.js; it names joints by index and hands back a
 * description of the frame. That seam is what lets the whole thing be
 * driven in node and checked against numbers.
 */

import meta from './cat-rig.json';

const DEG = Math.PI / 180;

export const BONES = meta.bones as string[];
export const BONE = Object.fromEntries(BONES.map((n, i) => [n, i])) as Record<string, number>;
export const CLIP_META = meta.clips as { name: string; loop: boolean; seconds: number; pivot: number[] }[];
const PIVOT = Object.fromEntries(CLIP_META.map((c) => [c.name, c.pivot])) as Record<string, number[]>;

/** Where the laser is, in world space. */
export type Sense = { x: number; y: number; z: number; present: boolean };

/** A rotation about a joint's own position, in world axes, applied in order. */
export type Turn = { joint: number; yaw: number; pitch: number };

export type Drive = {
  /** The clip playing, the one fading out, and how far the fade has got. */
  clip: string;
  from: string | null;
  time: number;
  fromTime: number;
  blend: number;
  turns: Turn[];
  /** Heading of the whole animal, and the point it turns about. */
  facing: number;
  pivot: [number, number, number];
};

export const TUNING = {
  /* How far the head will go before it stops looking like a head. Yaw is
     generous because a cat really does turn nearly side-on; pitch is not,
     because a cat lifts its chin far less than it feels like it does. */
  yawMax: 62 * DEG,
  pitchMax: 26 * DEG,

  /*
   * How the turn is shared out along the neck.
   *
   * All of it at the skull is a bobblehead. Spread evenly and the cat
   * looks boneless. A real turn is mostly skull with the last two neck
   * joints contributing a little, which also means the throat follows
   * rather than creasing.
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
   * move before it re-aims at all, and `settle` how long it must stay
   * there first. The stillness between is what reads as attention — a head
   * glued to the cursor is a servo.
   */
  notice: 0.09,
  settle: 0.1,
  turn: 0.19,

  /*
   * When the body turns, and how fast.
   *
   * A cat aims in three stages: eyes, then head, then body. `bodyNotice`
   * is how far off the laser has to be before the body bothers at all —
   * under that the neck handles it alone, which is most of the time and
   * is what keeps a still cat still.
   */
  bodyTurn: 0.62,
  bodyNotice: 14 * DEG,

  /*
   * Directly above a joint there is no direction to face.
   *
   * Aiming is `atan2` of a horizontal offset. Put the laser over the point
   * you are measuring from and that offset goes to zero, where atan2 is
   * undefined and a pixel of hand tremor swings the answer through a
   * half-circle. Inside this radius the cat keeps the heading it had and
   * just tips its head — which is what a cat does with something held over
   * it: it looks up, it does not pirouette.
   */
  overhead: 0.3,

  /*
   * Once committed to a turn, see it through.
   *
   * Re-deciding the heading every time the neck runs out of travel lets
   * the cat argue with itself: it commits, the turn moves the head, the
   * new reading disagrees, it commits the other way. A turn holds until
   * the hips have nearly arrived, or until it has plainly stalled.
   */
  arrived: 9 * DEG,
  recommit: 1.4,

  /*
   * The turn is not rigid.
   *
   * `shoulders` chase the target; the hips chase the shoulders, slower.
   * The gap between them goes into the spine as a twist, which is what
   * makes it a cat turning rather than a plinth rotating. Capped at what a
   * spine will actually do — past that the cat is a corkscrew.
   */
  hipLag: 1.15,
  twistMax: 22 * DEG,

  /* Breath, and the tail. The sitting clip is a held pose that does not
     move at all, so everything alive about a sitting cat happens here. */
  breathe: 1.9 * DEG,
  breathHz: 0.29,

  /*
   * Crouching at something on the floor.
   *
   * Driven by the laser's height, not its distance: a laser on the wall is
   * something to watch, one on the floor is something to catch. `hold` is
   * how long the cat stays down after the laser leaves the floor, so a
   * pointer wavering at the threshold does not make it bob up and down.
   */
  crouchFrom: -0.02,
  crouchAt: -0.45,
  hold: 1.1,

  /*
   * The paw.
   *
   * A cat with a dot near its foot does not swat at it on sight. It lifts
   * the paw and holds it there, cocked, watching — and then, at a moment
   * of its own choosing, commits. The holding is most of the behaviour and
   * all of the menace.
   *
   * So the swipe clip is played in two pieces. `poiseAt` is where the paw
   * is up and forward but not yet thrown, measured off the clip: the paw
   * leaves the floor at about 0.1s, peaks at 0.30s a whole body-length
   * out, and is back down by 0.60. Held at 0.18 it is raised and loaded.
   * `swipeEnd` is where the strike has landed and returned — the clip runs
   * on for another four tenths of a second doing nothing, and playing that
   * tail just delays the cat's next move.
   */
  pawRange: 0.42,
  poiseAt: 0.18,
  swipeEnd: 0.62,
  /* How long it hovers before committing, and how long it waits after. */
  poiseFor: [0.45, 1.6] as [number, number],
  pawEvery: [0.7, 1.9] as [number, number],

  /** Cross-fade between clips. Long enough to hide a seam, short enough
      that the cat is never visibly two cats at once. */
  fade: 0.22,
};

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** An angle difference brought into (−π, π]. */
function wrap(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

export class Cat {
  private t = 0;
  private aim = { yaw: 0, pitch: 0 };
  private want = { yaw: 0, pitch: 0 };
  private seen = { x: 0, y: 0, has: false };
  private dwell = 0;
  private interest = 0;

  private body = 0;
  private shoulders = 0;
  private bodyWant = 0;
  private sinceCommit = 99;

  /** The clip playing, the one fading out, and the fade's progress. */
  private clip = 'sit';
  private time = 0;
  private from: string | null = null;
  private fromTime = 0;
  private fade = 1;

  /** Which of sit or sneak the cat returns to, and how long it has been
      since the laser was last on the floor. */
  private base = 'sit';
  private offFloor = 999;
  private nextSwipe = 0;
  /** Set while the paw is up but not yet thrown, and when it will throw. */
  private poised = false;
  private strikeAt = 0;
  /** Where the paw rests, remembered from the last frame it was down. */
  private pawRest: [number, number, number] = [0.9, -0.76, -0.09];

  get facing(): number {
    return this.body;
  }

  /**
   * @param head where the head joint currently is, in world space — read
   *   back from the rig, because the cat's own animation moves it a long
   *   way between sitting and crouching and aiming from a fixed point
   *   would have it looking past anything close by.
   * @param paw likewise for the working front paw. Only sampled while the
   *   paw is DOWN: once it lifts, the thing being reached for must not
   *   move with the reaching, or the cat chases its own foot.
   */
  update(dt: number, world: Sense, head: [number, number, number],
         paw: [number, number, number] = this.pawRest): Drive {
    this.t += dt;
    this.time += dt;
    this.sinceCommit += dt;
    this.fromTime += dt;
    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / TUNING.fade);

    /*
     * Everything below works in the cat's own frame.
     *
     * The body turns, so a pointer that has not moved in the world HAS
     * moved relative to the cat. Doing this in world space would make the
     * cat chase its own rotation: it turns toward the laser, which then
     * appears to have shifted, so it turns again.
     *
     * The SHOULDERS' heading, not the hips'. Everything above the chest
     * hangs off the spine twist, so that is the frame it is posed in.
     */
    const s = this.toLocal(world);
    const turns: Turn[] = [];
    if (this.clip !== 'swipe') this.pawRest = paw;

    /* ---- the floor, and what the cat is doing about it ----------------- */
    const low = s.present && s.y < TUNING.crouchFrom;
    this.offFloor = low ? 0 : this.offFloor + dt;

    if (this.clip === 'swipe') {
      this.paw(dt, s);
    } else if (this.busy()) {
      /* A transition owns the body until it finishes. */
      if (this.time >= this.duration(this.clip)) {
        this.play(this.clip === 'rise' ? 'sneak' : this.clip === 'settle' ? 'sit' : this.base);
        if (this.clip === 'sneak' || this.clip === 'sit') this.base = this.clip;
      }
    } else if (this.base === 'sit' && low) {
      this.base = 'sneak';
      this.play('rise');
    } else if (this.base === 'sneak' && this.offFloor > TUNING.hold) {
      this.base = 'sit';
      this.play('settle');
    } else if (this.inReach(s) && this.t > this.nextSwipe) {
      this.play('swipe');
      this.poised = true;
      this.strikeAt = this.t + TUNING.poiseFor[0]
        + Math.random() * (TUNING.poiseFor[1] - TUNING.poiseFor[0]);
    }

    /* ---- deciding where to look --------------------------------------- */
    if (s.present) {
      const moved = this.seen.has ? Math.hypot(s.x - this.seen.x, s.y - this.seen.y) : Infinity;
      this.dwell = moved > TUNING.notice ? this.dwell + dt : 0;
      if (this.dwell > TUNING.settle) {
        this.dwell = 0;
        this.seen = { x: s.x, y: s.y, has: true };

        /*
         * The cat faces +x, up is +y. Yaw turns it about the world up
         * axis; pitch tips it about the sideways one.
         *
         * The sign on yaw is not cosmetic: rotating about +y takes +x
         * toward −z, so aiming at a target on +z needs a negative angle.
         * Getting it backwards gives a cat that pointedly looks away from
         * the cursor, which is funny exactly once.
         */
        const dx = s.x - head[0], dy = s.y - head[1], dz = s.z - head[2];
        const reach = Math.hypot(dx, dz);

        /* Pitch is well behaved everywhere: straight overhead it saturates
           at `pitchMax`, which is a cat looking up. */
        this.want.pitch = clamp(Math.atan2(dy, reach), -TUNING.pitchMax, TUNING.pitchMax);

        /* Yaw is not. Inside `overhead` the horizontal direction is noise,
           so the cat keeps the aim it had. */
        if (reach > TUNING.overhead) {
          this.want.yaw = clamp(-Math.atan2(dz, dx), -TUNING.yawMax, TUNING.yawMax);
        }

        /*
         * The body decides from the PIVOT, not from the head.
         *
         * Measuring the turn from the head is a feedback loop, because
         * turning is what moves the head. The head swings about half a
         * body-length as the cat comes round, so a laser nearer than that
         * ends up on the other side of it, the next reading disagrees with
         * the last, and the cat argues with itself — six hundred degrees
         * of travel from a pointer sitting still near the middle of the
         * frame, which is exactly where a hand rests.
         *
         * The pivot is the point the cat rotates ABOUT. It does not move
         * when the cat turns, by definition, so reading the heading from
         * it cannot feed back. The head still aims at the laser; it just
         * no longer gets a vote on which way the body goes.
         */
        const pv = this.pivot();
        const bx = s.x - pv[0], bz = s.z - pv[2];
        if (Math.hypot(bx, bz) > TUNING.overhead) {
          /*
           * The body goes all the way round, not just as far as the neck
           * cannot reach.
           *
           * Handing the body only the overflow leaves it square to the
           * camera with the head craned over its shoulder: at the top of
           * the frame the target is 127° away, the neck covers 62 of that,
           * and the body settles at 65 — three-quarters turned and looking
           * awkward about it. Giving it the whole angle puts the cat's
           * back to the viewer, which is what an animal watching something
           * behind it actually does.
           *
           * The head still leads, because it has to: the neck settles in a
           * fifth of a second and the hips take three times that, so the
           * look happens first and the body catches up.
           */
          const toward = -Math.atan2(bz, bx);
          const worth = Math.abs(toward) > TUNING.bodyNotice;
          const free = Math.abs(wrap(this.bodyWant - this.body)) < TUNING.arrived
            || this.sinceCommit > TUNING.recommit;
          if (worth && free) {
            this.bodyWant = this.shoulders + toward;
            this.sinceCommit = 0;
          }
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

    const bk = 1 - Math.exp(-dt / TUNING.bodyTurn);
    this.shoulders += (this.bodyWant - this.shoulders) * bk;
    const hk = 1 - Math.exp(-dt / (TUNING.bodyTurn * TUNING.hipLag));
    this.body += (this.shoulders - this.body) * hk;

    /*
     * Order matters from here down.
     *
     * Each turn rotates a joint and everything below it, about where that
     * joint is at the moment it is applied. So the spine has to twist
     * before the neck aims, or the neck aims from where the neck used to
     * be and the head arrives somewhere else.
     */
    const twist = clamp(this.shoulders - this.body, -TUNING.twistMax, TUNING.twistMax);
    if (twist) turns.push({ joint: BONE.RigSpine1, yaw: twist, pitch: 0 });

    /* Breath, shallower when the cat is paying attention — which is what
       a cat that has noticed something actually does. */
    const depth = TUNING.breathe * (1 - 0.45 * this.interest);
    turns.push({
      joint: BONE.RigChest,
      yaw: 0,
      pitch: depth * Math.sin(this.t * Math.PI * 2 * TUNING.breathHz),
    });

    for (const [name, share] of TUNING.chain) {
      const j = BONE[name];
      if (j === undefined) continue;
      turns.push({ joint: j, yaw: this.aim.yaw * share, pitch: this.aim.pitch * share });
    }

    this.tail(turns);

    return {
      clip: this.clip,
      from: this.fade < 1 ? this.from : null,
      time: this.time,
      fromTime: this.fromTime,
      blend: this.fade,
      turns,
      facing: this.body,
      pivot: this.pivot(),
    };
  }

  /* ------------------------------------------------------------ clips */

  /** Refuse to swipe again for a while. */
  private rest(): void {
    this.nextSwipe = this.t + TUNING.pawEvery[0]
      + Math.random() * (TUNING.pawEvery[1] - TUNING.pawEvery[0]);
  }

  private busy(): boolean {
    return this.clip === 'rise' || this.clip === 'settle' || this.clip === 'swipe';
  }

  /**
   * The paw, up and waiting, and then thrown.
   *
   * While poised the clip is held at `poiseAt` — the paw raised and
   * loaded. It comes down again the moment the laser leaves reach, which
   * is the whole point: the cat is reacting to the dot, not running an
   * animation at it. If the dot stays, the strike goes in on its own
   * schedule and the clip is allowed to run.
   */
  private paw(dt: number, s: Sense): void {
    if (this.poised) {
      this.time = Math.min(this.time, TUNING.poiseAt);
      if (!this.inReach(s)) {
        /* Lost interest: put the foot down, and do not immediately try
           again, or a laser wobbling on the edge of reach makes the cat
           pump its leg. */
        this.poised = false;
        this.rest();
        this.play(this.base);
      } else if (this.t > this.strikeAt) {
        this.poised = false;
      }
      return;
    }
    if (this.time >= TUNING.swipeEnd) {
      /* The cooldown starts when the swipe ENDS, not when it starts.
         Measured from the start it is mostly consumed by the swipe's own
         runtime, and the cat swats without pause like a toy. */
      this.rest();
      this.play(this.base);
    }
  }

  private duration(name: string): number {
    return CLIP_META.find((c) => c.name === name)?.seconds ?? 0;
  }

  private play(name: string): void {
    if (name === this.clip) return;
    this.from = this.clip;
    this.fromTime = this.time;
    this.clip = name;
    this.time = 0;
    this.fade = 0;
  }

  /**
   * The point the cat turns about, blended like the clips are.
   *
   * A sitting cat pivots on its haunches and a crouched one on all four
   * feet, which are a fifth of a body-length apart. Holding one pivot for
   * both makes the cat skate sideways as it rises.
   */
  private pivot(): [number, number, number] {
    const a = PIVOT[this.clip] ?? [0, 0, 0];
    const b = this.fade < 1 && this.from ? PIVOT[this.from] ?? a : a;
    const f = this.fade;
    return [b[0] + (a[0] - b[0]) * f, 0, b[2] + (a[2] - b[2]) * f];
  }

  /* -------------------------------------------------------- the swipe */

  /**
   * Is the laser within reach of the working paw?
   *
   * Measured horizontally against where the paw actually is — read back
   * from the rig, because it moves half a body-length between sitting and
   * crouching and a hard-coded reach is wrong in at least one of them.
   * Horizontally, because the laser rides a plane above the floor and its
   * height is never the paw's; what matters is whether the cat could put
   * its foot on the dot.
   */
  private inReach(s: Sense): boolean {
    if (!s.present) return false;
    if (s.y > TUNING.crouchFrom + 0.3) return false;
    return Math.hypot(s.x - this.pawRest[0], s.z - this.pawRest[2]) < TUNING.pawRange;
  }

  /* ---------------------------------------------------------- the tail */

  /**
   * A travelling wave down the tail.
   *
   * Each joint lags the one before it, so a slow sweep at the root arrives
   * at the tip late and larger. In phase, the whole tail hinges like a
   * lever and reads as a rudder rather than an animal.
   *
   * The sneak clip already moves the tail, so this rides on top of it and
   * stays small; the sitting clip does not move at all, and without this
   * the sitting cat has a dead tail.
   */
  private tail(turns: Turn[]): void {
    const amp = (1.1 + 3.4 * this.interest) * DEG;
    const speed = 0.5 + 1.5 * this.interest;
    for (let i = 0; i < 6; i++) {
      const j = BONE[`RigTail${i + 1}`];
      if (j === undefined) continue;
      const lag = i * 0.55;
      const grow = 0.6 + i * 0.28;
      turns.push({
        joint: j,
        yaw: amp * grow * Math.sin(this.t * speed - lag),
        pitch: amp * grow * 0.5 * Math.sin(this.t * speed * 0.63 - lag * 0.8),
      });
    }
  }

  /**
   * The world pointer, in the cat's own frame.
   *
   * Everything read back from the rig — the head, the paw — is in this
   * frame already, because the clip is composed before the heading is
   * applied: the renderer turns the whole object afterwards. So the
   * pointer is the one thing that has to be brought across, and it has to
   * be brought across the SAME way the renderer takes the cat the other
   * way — about the pivot, not about the origin. Rotating about the origin
   * instead leaves an error of up to twice the pivot offset, which is a
   * quarter of a unit: small enough to look like sloppy aim, large enough
   * to make the paw miss.
   *
   * The shoulders' heading rather than the hips', because everything above
   * the spine twist is posed in the shoulders' frame.
   */
  private toLocal(w: Sense): Sense {
    const c = Math.cos(-this.shoulders), sn = Math.sin(-this.shoulders);
    const pv = this.pivot();
    const x = w.x - pv[0], z = w.z - pv[2];
    return { x: pv[0] + x * c + z * sn, y: w.y, z: pv[2] - x * sn + z * c, present: w.present };
  }
}
