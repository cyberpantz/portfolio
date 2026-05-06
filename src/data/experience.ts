export interface Role {
  co: string;
  role: string;
  yr: string;
  tags: string[];
  bullets: string[];
}

export const EXPERIENCE: Role[] = [
  {
    co: 'ChargePoint',
    role: 'Staff Frontend Engineer',
    yr: '2021–2026',
    tags: ['Microfrontends', 'React', 'TypeScript', 'Tailwind', 'Fleet'],
    bullets: [
      'Led frontend architecture for fleet EV charging platform',
      'Built real-time fleet monitoring and analytics interfaces',
      'Developed schema-driven UI systems and complex data tables',
      'Mentored engineers, worked closely with product and design',
      'Drove WCAG/ADA accessibility initiatives',
    ],
  },
  {
    co: 'Kaiser Permanente',
    role: 'UI Architect',
    yr: '2020–2021',
    tags: ['Greenfield', 'React', 'TypeScript', 'Node'],
    bullets: [
      'Sole frontend engineer on a greenfield healthcare application',
      'Defined architecture, delivered wireframes, mockups, and full React/TypeScript implementation with Node backend',
      'This was a short-term contract role during the covid-19 pandemic (I had an entire office floor to myself! That was a first!)',
    ],
  },
  {
    co: 'Tesla',
    role: 'Senior Applications Developer',
    yr: '2015–2019',
    tags: ['Configurator', 'React', 'Redux', 'i18n', 'Node'],
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
    tags: ['Flex', 'Backbone', 'Bootstrap' ,'UX', 'Data Viz'],
    bullets: [
      'Built data visualization tools using Adobe Flex and Backbone',
      'Small company, so I split role as UX designer and information architect', 
      'Early work on energy data dashboards and reporting tools',
    ],
  },
  {
    co: 'Earlier Career',
    role: 'Various Roles',
    yr: '2000–2008',
    tags: ['Full-Stack', 'Education', 'Government', 'Advertising'],
    bullets: [
      'Partner at Protrigga Design — interactive advertising',
      'Senior Developer at CaratFusion',
      'Instructional Designer at Academy of Art',
      'Senior Applications Developer at County of Humboldt',
      'Associate Faculty at College of the Redwoods',
    ],
  },
];
