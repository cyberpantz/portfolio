export interface Project {
  id: string;
  name: string;
  tagline: string;
  url: string | null;
  tags: string[];
  year: string;
  description: string;
  /** Hex placeholder color shown when images is absent or empty. */
  color: string;
  /** Paths relative to /public. First image is the hero. */
  images?: string[];
}

export const PROJECTS: Project[] = [
  {
    id: 'crumb',
    name: 'The Crumb',
    tagline: 'AI sourdough bake journal & diagnosis',
    url: 'https://thecrumb.app',
    tags: ['LLM', 'Vision API', 'React', 'Node'],
    year: '2024',
    description:
      'Photograph your loaf, get an AI diagnosis of the crumb structure, and learn exactly what to adjust on the next bake. Built with a vision LLM, React frontend, and Node backend. Solves a real problem I had — sourdough is finicky and the feedback loop is slow.',
    color: '#8b5e3c',
    images: [
      '/projects/thecrumb/thecrumb-1.png',
      '/projects/thecrumb/thecrumb-2.png',
      '/projects/thecrumb/thecrumb-3.png',
      '/projects/thecrumb/thecrumb-4.png',
      '/projects/thecrumb/thecrumb-5.png',
    ],
  },
  {
    id: 'fleet-monitor',
    name: 'Fleet Monitor',
    tagline: 'Real-time EV charging dashboard concept',
    url: null,
    tags: ['React', 'WebSocket', 'D3', 'TypeScript'],
    year: '2023',
    description:
      'Personal exploration of real-time fleet data visualization patterns developed alongside my work at ChargePoint. Experiments in dense data tables, live status indicators, and constraint-aware scheduling UI.',
    color: '#2a4a7a',
  },
  {
    id: 'type-specimen',
    name: 'Type Specimen',
    tagline: 'Interactive typography explorer',
    url: null,
    tags: ['Vanilla JS', 'CSS', 'Typography'],
    year: '2023',
    description:
      'A personal tool for exploring typeface pairings and optical sizing. Drag sliders, compare specimens, export CSS variables. Built in a weekend to scratch my own itch.',
    color: '#3a3a3a',
  },
];
