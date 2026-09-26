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
  /*
   * Up and down are not the same.
   *
   * A cat lifts its chin far less than it feels like it does, and drops it
   * a very long way — to eat, to wash, to watch something by its feet.
   * Measured: a laser on the floor at the middle of the frame sits 49°
   * below the head. Held at a symmetric 26° the cat could not actually
   * look at the thing it was supposed to be staring at, and gazed into the
   * middle distance over the top of it.
   */
  pitchMax: 26 * DEG,
  pitchDown: 52 * DEG,

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
  overhead: 0.55,

  /*
   * The same idea for the head, and much smaller.
   *
   * The head sits about 0.44 forward of the pivot, so once the cat has
   * turned to face something a body-length away, that thing is only a
   * couple of tenths from its nose — well inside a dead zone sized for the
   * body. The head then stopped aiming entirely and sat pinned at its 62°
   * limit while the dot went back and forth in front of it.
   *
   * The zone only has to cover the case it was built for: a laser directly
   * above the skull, where the horizontal direction to it is genuinely
   * undefined. A tenth of a body does that and leaves the near field to be
   * tracked properly.
   */
  overheadHead: 0.12,

  /*
   * How far round a thing has to go before a cat that has ALREADY squared
   * up to it will turn again.
   *
   * Two thresholds, not one. Acquiring something takes `bodyNotice`, so a
   * dot arriving at the cat's feet gets faced properly. Once the body has
   * arrived and settled, the bar goes up to this: the dot is close, a
   * small move of the hand swings a large angle, and a body that answers
   * every one of them shuffles on the spot forever. Between the two the
   * neck does the work, which is what it is for.
   *
   * A single threshold fails whichever way it is set. Low, and the cat
   * shuffles; high, and it never turns to face the thing in the first
   * place — it sat at 58° off, watching out of the corner of its eye.
   */
  bodyRound: 75 * DEG,
  /** How long the hips must hold still before the wider bar applies. */
  squaredFor: 0.5,

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
  crouchFrom: -0.35,
  crouchAt: -0.78,
  hold: 1.1,

  /*
   * How far away a thing has to be before stalking it is worth doing.
   *
   * Stalking something already at your feet is absurd — there is nothing
   * to close. A cat with a dot right in front of it sits up and stares at
   * it instead, which is a completely different and much more pointed
   * piece of body language.
   *
   * Measured against the frame: with the pointer low, the middle of the
   * canvas lands about 1.54 from the cat and the bottom corners reach 1.84
   * and 2.09. 1.7 separates "in front of my face" from "over there".
   */
  stalkFrom: 1.7,

  /*
   * Ears.
   *
   * Flattened back is the whole tell. Rotating them backward about the
   * cat's lateral axis is the readable part of it; the sideways splay a
   * real cat adds would need a roll, which a yaw-and-pitch pose cannot
   * express and which reads as almost nothing at this point density.
   *
   * The base turns further than the tip, so the ear folds rather than
   * hinging like a flap.
   */
  earsBack: 34 * DEG,
  earsFor: 0.55,

  /*
   * Ears that are paying attention, as distinct from ears that are cross.
   *
   * They already ride the head, so they arrive pointed roughly the right
   * way. What is missing is the swivel — an ear turns FURTHER than the
   * skull it is on, and gets there first. A small share of the aim added
   * on top gives that, and a little perk forward with it.
   *
   * Small on purpose. At this point density an ear is about a hundred
   * points, and anything larger reads as a rabbit.
   */
  earsTrack: 0.22,
  earsPerk: 7 * DEG,

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
  /*
   * Reach, measured in three dimensions from the paw itself.
   *
   * Flat distance plus a height gate was the obvious way and it was a
   * mess: a dot resting on the cat's chest is only 0.41 from its paw
   * measured horizontally, so the cat batted at its own ribs, and the
   * height cutoff that excluded it also excluded most of the floor —
   * leaving a band about a tenth of the frame wide where a swipe was
   * possible at all.
   *
   * Straight-line distance separates them with room to spare. Measured:
   * the dot on the chest sits 0.95 from the paw; dots on the floor within
   * a body-length run 0.60 to 0.75. From the paw, because the paw drops
   * when the animal crouches and a fixed point is wrong in one pose or the
   * other.
   */
  pawRange: 0.8,
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
  /**
   * @param rand where the cat's small unpredictabilities come from. Left
   *   alone it is `Math.random`; a test passes its own so that "does it
   *   ever swipe" is a fact rather than a coin flip.
   */
  constructor(private rand: () => number = Math.random) {}

  private t = 0;
  private aim = { yaw: 0, pitch: 0 };
  private want = { yaw: 0, pitch: 0 };
  private seen = { x: 0, y: 0, z: 0, has: false };
  private dwell = 0;
  private interest = 0;
  /** 0 at ease, 1 staring down at something sitting right in front of it. */
  private annoyed = 0;

  private body = 0;
  private shoulders = 0;
  private bodyWant = 0;
  private sinceCommit = 99;
  /** How long the body has been where it wanted to be. */
  private squared = 0;

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
    this.squared = Math.abs(wrap(this.bodyWant - this.body)) < TUNING.arrived
      ? this.squared + dt
      : 0;
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
    /*
     * Two different things can be true of a laser on the floor, and they
     * call for opposite behaviour. Far off, it is prey: the cat gets up
     * and stalks it. Right at its feet, there is nothing to stalk, so it
     * sits up and stares down at it instead — and gets visibly annoyed
     * about it, which is the more interesting of the two to watch.
     */
    const pv = this.pivot();
    const ground = s.present ? Math.hypot(s.x - pv[0], s.z - pv[2]) : Infinity;
    const onFloor = s.present && s.y < TUNING.crouchFrom;
    const low = onFloor && ground > TUNING.stalkFrom;
    const underfoot = onFloor && ground <= TUNING.stalkFrom;
    this.offFloor = low ? 0 : this.offFloor + dt;
    this.annoyed += ((underfoot ? 1 : 0) - this.annoyed) * Math.min(1, dt * 1.6);

    if (this.clip === 'swipe') {
      this.paw(s);
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
        + this.rand() * (TUNING.poiseFor[1] - TUNING.poiseFor[0]);
    }

    /* ---- deciding where to look --------------------------------------- */
    if (s.present) {
      /*
       * A cat with something at its feet does not do the deliberate
       * thing.
       *
       * `notice` and `settle` are what make it hold still and then commit,
       * and at a distance that is the whole character. Up close, with a
       * dot going back and forth in front of its nose, the same pause
       * reads as a cat that is not paying attention — the head arrives
       * somewhere the dot has already left. So both shrink to almost
       * nothing as the cat fixes on something underfoot, and the neck
       * spring tightens with them.
       */
      const keen = this.annoyed;
      const notice = TUNING.notice * (1 - 0.85 * keen);
      const settle = TUNING.settle * (1 - 0.9 * keen);

      /*
       * How far the dot has moved — in all THREE axes.
       *
       * This used to measure x and y and ignore z, which was survivable
       * when the pointer rode a plane facing the camera, because screen-x
       * was mostly world x and screen-y was mostly world y. On a plane
       * tilted toward the floor it is not: a sideways sweep moves the dot
       * mostly in x and z, and with z left out the cat could not see
       * horizontal movement at all. At the top of the frame its head sat
       * frozen three degrees off centre while the thing it was supposedly
       * watching swung twenty-five degrees either way.
       */
      const moved = this.seen.has
        ? Math.hypot(s.x - this.seen.x, s.y - this.seen.y, s.z - this.seen.z)
        : Infinity;
      this.dwell = moved > notice ? this.dwell + dt : 0;
      if (this.dwell > settle) {
        this.dwell = 0;
        this.seen = { x: s.x, y: s.y, z: s.z, has: true };

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
        this.want.pitch = clamp(Math.atan2(dy, reach), -TUNING.pitchDown, TUNING.pitchMax);

        /*
         * Yaw is not. Inside `overheadHead` the horizontal direction is
         * noise — and the answer there is to look STRAIGHT AHEAD, not to
         * hold the last angle. Holding it leaves the cat with its head
         * cranked hard over, staring past a dot that is under its own
         * chin, which is what it did.
         */
        let wanted = 0;
        if (reach > TUNING.overheadHead) {
          wanted = -Math.atan2(dz, dx);
        }
        this.want.yaw = clamp(wanted, -TUNING.yawMax, TUNING.yawMax);

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
        const bx = s.x - pv[0], bz = s.z - pv[2];
        if (ground > TUNING.overhead) {
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
          /*
           * Watching something at its feet, the body stays put.
           *
           * The dot is close, so a small sideways move of the hand swings
           * a large angle at the pivot, and a body that answers every one
           * of them shuffles continuously. It has no reason to: the neck
           * covers 62° either way, which is most of the frame at that
           * distance. So while the cat is fixed on something underfoot the
           * body only moves when the NECK has run out — measured at the
           * head, where the running out actually happens.
           */
          const toward = -Math.atan2(bz, bx);
          /*
           * Once squared up, the body stays squared up.
           *
           * This was limited to a dot underfoot, which is where the
           * shuffling was first noticed — but nothing about the problem
           * is particular to the floor. Anywhere the cat has turned to
           * face something and settled, the neck's 62° either way covers
           * most of what a hand does next, and a body that answers every
           * one of those swings instead of letting the head work shuffles
           * on the spot. Measured at the top of the frame, a dot swinging
           * 64° dragged the body through 113°.
           */
          const holding = this.squared > TUNING.squaredFor;
          const worth = Math.abs(toward)
            > (holding ? TUNING.bodyRound : TUNING.bodyNotice);
          const free = Math.abs(wrap(this.bodyWant - this.body)) < TUNING.arrived
            || this.sinceCommit > TUNING.recommit;
          if (worth && free) {
            this.bodyWant = this.shoulders + toward;
            this.sinceCommit = 0;
            this.squared = 0;
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

    const k = 1 - Math.exp(-dt / (TUNING.turn * (1 - 0.5 * this.annoyed)));
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

    this.ears(turns);
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
      + this.rand() * (TUNING.pawEvery[1] - TUNING.pawEvery[0]);
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
  private paw(s: Sense): void {
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
    return Math.hypot(s.x - this.pawRest[0], s.y - this.pawRest[1], s.z - this.pawRest[2])
      < TUNING.pawRange;
  }

  /* ---------------------------------------------------------- the tail */

  /**
   * Ears back, when something will not leave.
   *
   * These ride on top of whatever the clip is doing, and the ear bones
   * hang off the head — so the head aims first and the ears fold on the
   * result, which is the order the animal does it in.
   */
  private ears(turns: Turn[]): void {
    /* Cross, and attentive, are different things and both can be true. */
    const back = this.annoyed * TUNING.earsBack;
    const perk = this.interest * TUNING.earsPerk;
    const swivel = this.aim.yaw * TUNING.earsTrack * this.interest;
    if (back < 0.002 && perk < 0.002 && Math.abs(swivel) < 0.002) return;

    for (const [name, share] of [
      ['RigLEar1', 1], ['RigREar1', 1],
      ['RigLEar2', TUNING.earsFor], ['RigREar2', TUNING.earsFor],
    ] as [string, number][]) {
      const j = BONE[name];
      if (j === undefined) continue;
      /* Flattening wins over perking: a cat that has decided to be cross
         about something is not also pricking its ears at it. */
      turns.push({
        joint: j,
        yaw: swivel * share * (1 - this.annoyed),
        pitch: (perk * (1 - this.annoyed) - back) * share,
      });
    }
  }

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
    const amp = (1.1 + 3.4 * this.interest + 5.0 * this.annoyed) * DEG;
    const speed = (0.5 + 1.5 * this.interest) * (1 + 1.1 * this.annoyed);
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
