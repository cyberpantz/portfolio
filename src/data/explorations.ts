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
}

export const EXPLORATIONS: Exploration[] = [
  {
    id: 'clickwheel',
    name: 'Click Wheel',
    type: 'Object',
    tags: ['CSS', 'Canvas', 'Interaction', 'Audio'],
    url: '/explorations/clickwheel',
    desc: 'A recreation of the retro click-wheel iPod, drawn entirely in CSS and canvas — superellipse body, layered glass, a 176×132 one-bit screen. No images.',
  },
  {
    id: 'quizzolator',
    name: 'The Quizzolator',
    type: 'Game',
    tags: ['Framer Motion', 'React', 'Interaction', 'A11y'],
    url: '/explorations/quizzolator',
    desc: 'A quiz engine built around its transitions — staggered springs, one question at a time. ',
  },
  {
    id: 'pattern-match',
    name: 'Pattern Match',
    type: 'Game',
    tags: ['Game', 'AudioContext', 'React'],
    url: '/explorations/pattern-match',
    desc: 'Colour and sound sequence memory, after the 1980s Simon. Each colour generates its tone through the AudioContext API rather than playing a file.',
  },
  {
    id: 'wage-gap',
    name: 'Wage Gap',
    type: 'Interactive',
    tags: ['Audio', 'React', 'Data'],
    url: '/explorations/wage-gap',
    desc: 'Enter your hourly rate and watch the money stack up in real time, against the national average and against Elon Musk.',
  },
  {
    id: 'weather-vibe',
    name: 'Weather Vibe',
    type: 'Experience',
    tags: ['WebGL', 'Three.js', 'Shaders', 'Web Audio'],
    url: '/explorations/weather-vibe',
    desc: 'A vibe-coded meditative 3D scene that changes with the weather for the current location. Open source ambient soundscapes and shaders for rain, fog and golden hour.',
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
    needsRoom: true,
  },
];

/** What the homepage and the index actually render. */
export const VISIBLE_EXPLORATIONS = EXPLORATIONS.filter((e) => !e.hidden);
