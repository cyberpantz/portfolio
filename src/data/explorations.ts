export interface Exploration {
  id: string;
  name: string;
  type: string;
  desc: string;
  tags: string[];
  url?: string;
}

export const EXPLORATIONS: Exploration[] = [
  { id: 'pattern-match',     name: 'Pattern Match',    type: 'Game',        tags: ['Game','AudioContext','React'],
    url: '/explorations/pattern-match',
    desc: 'Color and sound sequence memory game inspired by the 1980s Simon. Uses the AudioContext API to generate sounds for each color.' },
  // { id: 'kitchen-dodgeball', name: 'Kitchen Dodgeball', type: 'Game',     tags: ['Game','Canvas','React'],
  //   url: '/explorations/kitchen-dodgeball',
  //   desc: 'Dodge falling kitchen chaos as a chef avatar. Progressively harder waves with boss items.' },
  { id: 'wage-gap',       name: 'Wage Gap',      type: 'Interactive', tags: ['Audio','React'],
    url: '/explorations/wage-gap',
    desc: 'Enter your hourly rate and watch the money stack up in real time. Compare your earnings to the national average and Elon Musk.' },
  { id: 'weather-vibe',   name: 'Weather Vibe',  type: 'Experience',  tags: ['WebGL','Three.js','Shaders','React'],
    url: '/explorations/weather-vibe',
    desc: 'A meditative 3D environment that lives in your local weather.' },
  // { id: 'chooser',           name: 'The Chooser',      type: 'Interactive', tags: ['Audio','React','Generative'],
  //   url: '/explorations/chooser',
  //   desc: 'Five choices. Each one has a soundtrack. Pick your vibe — the result tells you who you are today.' }
];
