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

export const EXPERIENCE: Role[] = [
  {
    co: 'ChargePoint',
    role: 'Staff Frontend Engineer',
    yr: '2021–2026',
    tags: ['Microfrontends', 'Websockets', 'React', 'TypeScript', 'Tailwind', 'React-Query', 'WCAG/ADA', 'CI/CD'],
    bullets: [
      'Led frontend architecture for fleet EV charging platform',
      'Built real-time fleet monitoring and analytics interfaces',
      'Developed schema-driven UI systems and complex data tables',
      'Mentored engineers, worked closely with product and design'
    ],
  },
  {
    co: 'Kaiser Permanente',
    role: 'UI Architect',
    yr: '2020–2021',
    tags: ['React', 'TypeScript', 'Node', 'UX Design'],
    bullets: [
      'Sole frontend engineer on a greenfield inventory application to keep track of touchscreen devices in use throughout Kaiser medical centers, which became critical during the covid-19 pandemic for telehealth and remote patient monitoring',
      'Defined UX, delivered wireframes, mockups, and full React/TypeScript implementation with Node backend',
      'This was a short-term contract role during the covid-19 pandemic (I had an entire office floor to myself! That was a first!)',
    ],
  },
  {
    co: 'Tesla',
    role: 'Senior Applications Developer',
    yr: '2015–2019',
    tags: [ 'React', 'Redux', 'NodeJS/ExpressJS/PHP','CI/CD'],
    bullets: [
      "One of the tech leads for Tesla's vehicle configurator — consumer-facing, 40+ markets",
      'Frontend polish, NodeJS services, unit testing, deployment pipelines',
      'Designed localization strategy for several high traffic applications',
      'Contributed to inventory vehicle discovery and purchasing flows',
    ],
  },
  {
    co: 'Power-One / ABB',
    role: 'UX Engineer',
    yr: '2010–2014',
    tags: ['Energy', 'Dashboards', 'UX', 'Backbone'],
    bullets: [
      'Led small frontend engineering team for renewable energy monitoring platform',
      'Built dashboards and analytics tools for real-time energy data and reporting',
    ],
  },
  {
    co: 'Fat Spaniel',
    role: 'Web Application Engineer',
    yr: '2008–2011',
    tags: ['Adobe Flex', 'Bootstrap' ,'Backbone', 'UX', 'Data Viz'],
    bullets: [
      'Built data visualizations for customer soloar and wind installations using Adobe Flex, Flash, and later HTML5/CSS3',
      'Small company: I split my role between UX designer and applications developer'
    ],
  },
  {
    co: 'Earlier Career',
    role: 'Various Roles',
    yr: '2002–2008',
    tags: ['Full-Stack', 'Education', 'Government', 'Advertising'],
    blurb: 'Early career focused on full-stack web development, interactive kiosks, working in advertising, government and education.',
    bullets: [
      { text: 'Protrigga Design — Partner · Interactive advertising & Flash production', dates: '2005–2009' },
      { text: 'CaratFusion — Senior Developer · Digital media & campaign tooling', dates: 'Nov 2005–Jun 2006' },
      { text: 'Academy of Art University — Instructional Designer · Online course curriculum', dates: 'Jun 2004–Mar 2005' },
      { text: 'County of Humboldt — Senior Applications Developer · Government web apps', dates: 'Jan 2002–Dec 2004' },
      { text: 'College of the Redwoods — Associate Faculty · Taught web design & development', dates: 'Jun 2002–Jun 2003' },
    ],
  },
];
