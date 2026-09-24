import type { ImageMetadata } from 'astro';

import tiltCover from '../assets/explorations/tilt.png';
import chatbotsCover from '../assets/explorations/chatbots.png';
import clickwheelCover from '../assets/explorations/clickwheel.png';
import weatherVibeCover from '../assets/explorations/weather-vibe.png';
import fowlPlayCover from '../assets/explorations/kitchen-dodgeball.png';
import wageGapCover from '../assets/explorations/wage-gap.png';
import quizzolatorCover from '../assets/explorations/quizzolator.png';
import patternMatchCover from '../assets/explorations/pattern-match.png';

export interface Exploration {
  id: string;
  name: string;
  type: string;
  desc: string;
  tags: string[];
  url?: string;
  /**
   * Hide from the homepage and the index without deleting anything.
   * The page still builds and stays reachable by direct URL, so
   * pulling one back is a one-word change rather than uncommenting a
   * block and hoping it still compiles.
   */
  hidden?: boolean;
  /** Warn on small screens where the experiment needs room. */
  needsRoom?: boolean;
  /**
   * Thumbnail, captured from the live experiment by `pnpm shots`.
   *
   * Imported rather than pointed at public/ so astro:assets optimises it
   * into responsive webp at build. Composed windows on one characteristic
   * moment, not whole-page screenshots — at card width a full page is
   * mush, which is the same conclusion projectsV2 reached about covers.
   */
  cover?: ImageMetadata;
  coverAlt?: string;
}

export const EXPLORATIONS: Exploration[] = [
  {
    id: 'tilt',
    name: 'The Tilt',
    type: 'Data',
    tags: ['Scrollytelling', 'SVG', 'React', 'Public data'],
    url: '/explorations/tilt',
    desc: 'Between 2002 and 2019 rural America began jailing people at a far faster rate than urban America — rates rose by half in the smallest counties while falling by a quarter in the largest. A county of three thousand once jailed at about the same rate as a county of a million. Now it is more than double. Built from the Vera Institute\u2019s data, with every figure computed from the source rather than typed.',
    cover: tiltCover,
    coverAlt:
      'Seven lines showing jail rates by county size, fanning apart between 2002 and 2019 as the smallest counties rise and the largest fall.',
  },
  {
    id: 'chatbots',
    name: 'Chatbots',
    type: 'Interface',
    tags: ['React', 'Conversational UI', 'A11y', 'Motion'],
    url: '/explorations/chatbots',
    desc: 'Always awake, endlessly patient, often useful — and, the second it stops understanding you, this shareholder-friendly design becomes absolutely infuriating. Helpfulness turns out to be a setting, and not always the one shareholders prefer. Three conversations on one engine, and one of them is not on your side. Enjoy the future.',
    cover: chatbotsCover,
    /*
     * The alt describes what is in the picture, not what the piece is
     * about — the card's own name and description already say that, and
     * a screen reader reading all three gets the same sentence three
     * times.
     */
    coverAlt:
      'A chat interface asking "Show me where. Be honest." above a line drawing of a sofa, with options to tap the arms, back, cushions or underneath.',
  },
  {
    id: 'clickwheel',
    name: 'Click Wheel',
    type: 'Object',
    tags: ['CSS', 'Canvas', 'Interaction', 'Audio'],
    url: '/explorations/clickwheel',
    desc: 'A recreation of the retro click-wheel iPod, drawn entirely in CSS and canvas — superellipse body, layered glass, a 176×132 one-bit screen. No images.',
    cover: clickwheelCover,
    coverAlt:
      'The recreated click-wheel iPod on a dark ground, its screen showing a track playing.',
  },
  {
    id: 'quizzolator',
    name: 'The Quizzolator',
    type: 'Game',
    tags: ['Framer Motion', 'React', 'Interaction', 'A11y'],
    url: '/explorations/quizzolator',
    desc: 'A quiz engine built around its transitions — staggered springs, one question at a time. ',
    cover: quizzolatorCover,
    coverAlt:
      'A typography question asking which of two words was kerned, with both specimens shown.',
  },
  {
    id: 'pattern-match',
    name: 'Pattern Match',
    type: 'Game',
    tags: ['Game', 'AudioContext', 'React'],
    url: '/explorations/pattern-match',
    desc: 'Colour and sound sequence memory, after the 1980s Simon. Each colour generates its tone through the AudioContext API rather than playing a file.',
    cover: patternMatchCover,
    coverAlt:
      'A grid of six coloured shape cards, one highlighted, partway through a round.',
  },
  {
    id: 'wage-gap',
    name: 'Wage Gap',
    type: 'Interactive',
    tags: ['Audio', 'React', 'Data'],
    url: '/explorations/wage-gap',
    desc: 'Enter your hourly rate and watch the money stack up in real time, against the national average and against Elon Musk.',
    cover: wageGapCover,
    coverAlt:
      'A flip counter of earnings climbing beside figures comparing it to the median worker and to Elon Musk.',
  },
  {
    id: 'weather-vibe',
    name: 'Weather Vibe',
    type: 'Experience',
    tags: ['WebGL', 'Three.js', 'Shaders', 'Web Audio'],
    url: '/explorations/weather-vibe',
    desc: 'A vibe-coded meditative 3D scene that changes with the weather for the current location. Open source ambient soundscapes and shaders for rain, fog and golden hour.',
    cover: weatherVibeCover,
    coverAlt:
      'A low-poly San Francisco street canyon under overcast light, looking toward a distant spire.',
    needsRoom: true,
  },
  // {
  //   id: 'chooser',
  //   name: 'The Chooser',
  //   type: 'Interactive',
  //   tags: ['Audio', 'React', 'Generative'],
  //   url: '/explorations/chooser',
  //   desc: 'Five choices, each with its own soundtrack. Pick your vibe and the result tells you who you are today.',
  // },
  {
    // Route stays /kitchen-dodgeball so existing links keep working;
    // the game has always called itself Fowl Play.
    id: 'kitchen-dodgeball',
    name: 'Fowl Play',
    type: 'Game',
    tags: ['Game', 'Canvas', 'React'],
    url: '/explorations/kitchen-dodgeball',
    desc: 'Hilarious result of late night vibe coding. Dodge falling kitchen items thrown by menacing chickens. Progressively harder waves, and boss fowl that do not play fair. ',
    cover: fowlPlayCover,
    coverAlt:
      'A dark play field with eggs falling toward a chef at the bottom of the screen.',
    needsRoom: true,
  },
];

/** What the homepage and the index actually render. */
export const VISIBLE_EXPLORATIONS = EXPLORATIONS.filter((e) => !e.hidden);

/**
 * Ken Burns drift vectors, one per card position.
 *
 * A pan needs a DIRECTION, and it needs to differ between neighbours —
 * six tiles all pulling the same way on hover reads as a canned effect,
 * which is the thing a Ken Burns move is supposed to avoid. Mixed
 * left/right/up/down means two adjacent cards never travel together.
 *
 * Percentages are of the tile, applied inside the hover scale. The scale
 * is what creates the overflow the translate slides within: at 1.16 the
 * image is 8% wider than its frame on each side, so a 5% pull (5.8%
 * once scaled) stays comfortably inside and never exposes an edge.
 */
export const THUMB_DRIFT = [
  { x: '-5%', y: '0%' },     // pull left
  { x: '5%', y: '-3%' },     // right, drifting up
  { x: '0%', y: '5%' },      // sink
  { x: '-4%', y: '-4%' },    // up and left
  { x: '5%', y: '3%' },      // right, settling down
  { x: '0%', y: '-5%' },     // rise
] as const;

/** Drift for card `i`, wrapping if the list outgrows the table. */
export const driftFor = (i: number) => THUMB_DRIFT[i % THUMB_DRIFT.length];

