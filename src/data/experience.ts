export interface Bullet {
  text: string;
  dates?: string;
}

export interface Role {
  co: string;
  role: string;
  yr: string;
  tags: string[];
  blurb?: string;
  bullets: (string | Bullet)[];
}

/**
 * Career chapters, sourced from Frank_Young_Resume_2026_DesignTechnologist.pdf.
 *
 * Two things changed from the earlier version of this file:
 *   - Protrigga Design was a bullet under "Earlier Career". A two-person
 *     agency where you were the entire technical half is a chapter, not
 *     a footnote, so it stands on its own.
 *   - Freelance / Contract 2019–2020 was missing entirely, which left an
 *     unexplained year between Tesla and Kaiser.
 *
 * The Role interface is unchanged so v1's Work.tsx keeps compiling.
 */
export const EXPERIENCE: Role[] = [
  {
    co: 'ChargePoint',
    role: 'Staff Frontend Engineer',
    yr: '2021–2026',
    tags: ['React', 'TypeScript', 'Tailwind', 'TanStack Query', 'AWS', 'Docker', 'WCAG'],
    blurb:
      'Led front-end architecture for the fleet charging platform, partnering with product and design from sketch to production.',
    bullets: [
      'Designed and built the Depot Map Designer — an interactive tool letting customers build EV charger maps and visualize real-time charging operations.',
      'Built reusable UI patterns, accessible components, drag-and-drop tables, and schema-driven forms adopted across multiple front-end teams.',
      'Turned complex real-time data into clear dashboards and decision-support interfaces.',
      'Mentored engineers; shaped front-end architecture, code quality, and accessibility practice.',
    ],
  },
  {
    co: 'Kaiser Permanente',
    role: 'UI Architect',
    yr: '2020–2021',
    tags: ['React', 'TypeScript', 'Node', 'UX Design'],
    bullets: [
      'Sole front-end engineer on a greenfield inventory app managing thousands of clinic touchscreen devices used for video visits — which became critical infrastructure during the pandemic.',
      'Defined the UX flows, produced the wireframes and mockups, then built the React/TypeScript front end and the Node APIs behind it.',
    ],
  },
  {
    co: 'Freelance / Contract',
    role: 'Applications Developer',
    yr: '2019–2020',
    tags: ['React', 'Next.js', 'Node', 'CMS'],
    bullets: [
      'React, Next.js, Node.js and CMS applications for Chegg, Experian, and other high-growth technology companies.',
    ],
  },
  {
    co: 'Tesla',
    role: 'Senior Applications Developer',
    yr: '2015–2019',
    tags: ['React', 'Redux', 'Node', 'Express', 'ElasticSearch'],
    bullets: [
      "One of the leads on Tesla's vehicle configurator — consumer-facing discovery, customization and purchase, shipped across global markets.",
      'Built A/B testing and controlled-rollout workflows, established testing practices, integrated with CI/CD pipelines.',
      'Partnered with design, product, localization and accessibility on brand-critical commerce experiences.',
    ],
  },
  {
    co: 'Power-One / ABB',
    role: 'User Experience Engineer',
    yr: '2010–2014',
    tags: ['Data Visualization', 'UX Design', 'JavaScript'],
    bullets: [
      'Led a small front-end team building reporting and data-visualization interfaces for solar and wind monitoring — UX design and development in one role.',
    ],
  },
  {
    co: 'Fat Spaniel Technologies',
    role: 'Web Application Engineer',
    yr: '2008–2011',
    tags: ['Adobe Flex', 'HTML5', 'CSS3', 'Data Viz', 'UX Design'],
    bullets: [
      'Led UI development and UX design for an energy monitoring platform — dashboards, charts and reporting tools.',
      'Helped move the product off Adobe Flex and Flash and onto HTML5/CSS3.',
    ],
  },
  {
    co: 'Protrigga Design',
    role: 'Partner · Interactive Advertising',
    yr: '2005–2009',
    tags: ['Flash', 'Motion', 'Audio', 'Interactive Advertising'],
    blurb:
      'A two-person interactive agency. I was the entire technical half - Bela Spohrer was the design half. Go check out his work <a href="https://bela-sf.com/" target="_blank">here</a>.',
    bullets: [
      'Built Flash campaign sites for Warner Bros. Records — deeply interactive artist and release sites with embedded music players and cinematic scenes.',
      'Motion and audio were the medium, not decoration: the whole experience was timeline, sound and state.'
    ],
  },
  {
    co: 'Earlier roles',
    role: 'Advertising, education, government',
    yr: '2002–2006',
    tags: ['Flash', 'PHP', 'JavaScript', 'Instructional Design'],
    blurb:
      'Foundational work that laid the groundwork for my career.',
    bullets: [
      {
        text: 'CaratFusion — Senior Flash / PHP / JavaScript Developer. Agency-side interactive advertising; animation and motion-driven brand experiences.',
        dates: '2005–2006',
      },
      {
        text: 'Academy of Art University — Instructional Designer. Developed course content with instructors and an editorial team, and built the animated interactive elements, quizzes, tests and video for online modules.',
        dates: '2004–2005',
      },
      {
        text: 'County of Humboldt — Senior Applications Developer. Government web applications.',
        dates: '2002–2004',
      },
      {
        text: 'College of the Redwoods — Associate Faculty. Taught web design and development, which is where I learned to explain a system.',
        dates: '2002–2003',
      },
    ],
  },
];
