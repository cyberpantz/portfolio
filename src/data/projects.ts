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
    tags: ['LLM', 'Claude API', 'React', 'Node', 'Railway', 'Cloudflare'],
    year: '2026',
    description:
      'A playful baking site where you can photograph your bread and get an AI diagnosis of the crumb structure, get feedback on all things baking, and learn exactly what to adjust on the next bake. Built with a vision LLM, React frontend, and Node backend. Solves a real problem I had as a beginner. I needed suggestions on how to improve my sourdough technique — sourdough is finicky and the feedback loop is slow via traditional methods. r/breadit or r/sourdough on Reddit are great communities, but it can be hard to get specific feedback on your technique and how to improve sometimes. The Crumb is a fun way to get that feedback in seconds, and track your progress over time.',
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
    id: 'type-specimen',
    name: 'Mealtrip',
    tagline: 'Meal planning and recipe management app',
    url: null,
    tags: ['React','NextJS', 'Tailwind', 'Vercel', 'Claude Code'],
    year: '2025',
    description:
      'A personal project that started me down the path of AI driven development. It started with a simple concept "I really dislike dealing with these messy spreadsheets for these group camping trips, I can build something fun to use and better!". What ended up happening was a classic AI newbie move falling down the rabbithole into endless feature development and no clear MVP. It was super fun to build and build all the features I could add without justification. That said, I\'m current working on refining and streamlining the concept into a proper MVP that can actaully be shipped, not just iterated on endlessly ad nauseum.',
       color: '#8b5e3c',
     images: ['/projects/mealtrip/mealtrip-1.png', 
      '/projects/mealtrip/mealtrip-7.png', 
      '/projects/mealtrip/mealtrip-3.png', 
      '/projects/mealtrip/mealtrip-4.png', 
      '/projects/mealtrip/mealtrip-8.png',
      '/projects/mealtrip/mealtrip-9.png'

     ],
  },
];
