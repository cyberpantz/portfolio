export interface SkillGroup {
  cat: string;
  items: string[];
}

export const SKILLS: SkillGroup[] = [
  { cat: 'Frontend', items: ['React', 'TypeScript', 'Tailwind CSS', 'Vite / Rspack / Webpack', 'CSS / HTML'] },
  { cat: 'Backend',  items: ['Node.js', 'Next.js', 'Express', 'REST APIs', 'GraphQL', 'PHP'] },
  { cat: 'Systems',  items: ['Microfrontends', 'CI/CD pipelines', 'AWS', 'Docker'] },
  { cat: 'Design',   items: ['Figma', 'WCAG / ADA Compliance', 'Data visualization', 'UX'] },
  { cat: 'AI / Recent', items: ['LLM APIs (OpenAI, Claude)', 'Prompt engineering', 'Vision APIs', 'AI-assisted dev workflows'] },
];
