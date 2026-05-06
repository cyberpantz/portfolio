export interface Exploration {
  id: string;
  name: string;
  type: string;
  desc: string;
  tags: string[];
  icon: string;
  url?: string;
}

export const EXPLORATIONS: Exploration[] = [
  { id: 'pattern-match', name: 'Pattern Match',    type: 'Game',               tags: ['Game','Audio','React'], icon: '🎮',
    url: '/explorations/pattern-match',
    desc: 'Color sequence memory game inspired by the 1980s Simon. Three difficulty levels with audio feedback.' },
  { id: 'kitchen-dodgeball', name: 'Kitchen Dodgeball', type: 'Game',        tags: ['Game','Canvas','React'], icon: '🍳',
    url: '/explorations/kitchen-dodgeball',
    desc: 'Dodge falling kitchen chaos as a chef avatar. Progressively harder waves with boss items.' },
  // { id: 'chooser',     name: 'The Chooser',      type: 'Interactive',        tags: ['Audio','React','Generative'], icon: '⚡',
  //   url: '/explorations/chooser',
  //   desc: 'Move your cursor between two worlds. Each image has a track — hover closer to one to bring it forward.' },
  { id: 'skrillatime', name: 'Skrillatime',      type: 'Interactive',        tags: ['Audio','React'], icon: '💵',
    url: '/explorations/skrillatime',
    desc: 'Enter your hourly rate and watch the money stack up in real time. A cash register rings every dollar.' },
];
