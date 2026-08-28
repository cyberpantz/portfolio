/**
 * Selected projects + case-study content.
 *
 * Copy is Frank's, taken verbatim from the v2 design handoff.
 *
 * Screenshots are imported rather than referenced from /public so
 * astro:assets can optimise them — the source PNGs are ~9 MB and go
 * out as responsive AVIF/WebP with intrinsic dimensions, which is
 * what spec §17 asks for.
 *
 * The same data renders in two places: the case-study dialog on the
 * homepage and the routed page at /work/[id]. Keeping it here is what
 * makes that possible — the handoff's open question about whether case
 * studies eventually need their own pages is already answered "both".
 */
import type { ImageMetadata } from 'astro';

/*
 * Covers are pre-cropped to 4:3 rather than left to object-cover.
 * These screens are shot at 1.6–2.3, and a centred auto-crop throws
 * away 17–42% of the width — on the wide ones that removed a headline
 * and half a card. The *-cover files are composed windows; the
 * full-width originals still carry the case-study spread.
 */
import crumbCover from '../assets/projects/crumb-cover.png';
import crumbHome from '../assets/projects/crumb-home.png';
import crumbBake from '../assets/projects/crumb-bake.png';
import crumbVerdict from '../assets/projects/crumb-verdict.png';
import crumbFermentation from '../assets/projects/crumb-fermentation.png';
import crumbStarter from '../assets/projects/crumb-starter.png';
import crumbEmail from '../assets/projects/crumb-email.png';
import vittlesCover from '../assets/projects/vittles-cover.png';
import vittlesProblem from '../assets/projects/vittles-problem.png';
import vittlesLanding from '../assets/projects/vittles-landing.png';
import vittlesOnboarding from '../assets/projects/vittles-onboarding.png';
import vittlesTrips from '../assets/projects/vittles-trips.png';
import vittlesPlan from '../assets/projects/vittles-plan.png';
import vittlesRecipe from '../assets/projects/vittles-recipe.png';
import vittlesChecklist from '../assets/projects/vittles-checklist.png';
import mealtripCover from '../assets/projects/mealtrip-cover.png';
import mealtripLanding from '../assets/projects/mealtrip-landing.png';
import mealtripEvents from '../assets/projects/mealtrip-events.png';
import mealtripKitchen from '../assets/projects/mealtrip-kitchen.png';
import mealtripDashboard from '../assets/projects/mealtrip-dashboard.png';

export interface Shot {
  src: ImageMetadata;
  /** Editorial caption — what the viewer should notice. */
  caption: string;
  /** Alt text. Describes the screen for someone who cannot see it. */
  alt: string;
}

export interface CaseNote {
  label: string;
  body: string;
}

export interface ProjectV2 {
  id: string;
  n: string;
  name: string;
  year: string;
  /** Badge on the card. Null for shipped work. */
  status: string | null;
  /** One line, sentence case. */
  tag: string;
  /** Card cover. Null renders the "No screens kept" well. */
  cover: ImageMetadata | null;
  coverAlt?: string;
  /** Case-study body — one paragraph. */
  para: string;
  notes: CaseNote[];
  stack: string;
  url: string | null;
  cta: string | null;
  shots: Shot[];
}

export const PROJECTS_V2: ProjectV2[] = [
  {
    id: 'the-crumb',
    n: '01',
    name: 'The Crumb',
    year: '2025–2026',
    status: null,
    tag: 'A bake journal that reads your loaf and tells you what the crumb means.',
    cover: crumbCover,
    coverAlt: "Lev, The Crumb's illustrated sourdough mascot, smiling.",
    para:
      'Sourdough has a slow feedback loop — change one variable, wait a week, guess at the result. The Crumb closes it. You log a bake, photograph the crumb, and get a structured read on fermentation, crust and shaping, scored against the numbers you actually used. Around the journal sit interactive models — a fermentation activity curve, a live starter ecosystem — that explain why the loaf turned out the way it did. Product, design, front end, backend and deployment are all mine.',
    notes: [
      {
        label: 'The problem',
        body: 'A million things can go wrong when you bake sourdough. Advice online is confident, contradictory and untethered from your kitchen.  Not everyone has a friend who bakes sourdough they can call. The Crumb closes it.',
      },
      {
        label: 'Product decisions',
        body: "The verdict is always tied to the bake's own variables, never generic advice. Scores are coarse on purpose — out of ten, four axes — so the tool reads as a second opinion, not a grade.",
      },
      {
        label: 'Tech',
        body: 'Claude Vision reads the crumb photos against the logged parameters. React and Tailwind front end, Hono API, PostgreSQL, deployed on Railway in Docker.',
      },
    ],
    stack: 'Claude Vision · React · Tailwind · Hono · PostgreSQL · Railway · Docker',
    url: 'https://thecrumb.app',
    cta: 'Visit thecrumb.app',
    shots: [
      {
        src: crumbHome,
        caption: 'Landing — tools for curious bakers',
        alt: "The Crumb's landing page: the headline \"Read between the crumbs\" beside an illustrated loaf.",
      },
      {
        src: crumbBake,
        caption: 'Bake detail — photos and the variables behind them',
        alt: 'A single bake record: crumb photographs beside the hydration, temperature and timing logged for that loaf.',
      },
      {
        src: crumbVerdict,
        caption: 'Analysis — verdict, fermentation read, four scores',
        alt: 'The analysis screen: a written verdict on the loaf, a fermentation assessment, and four scores out of ten.',
      },
      {
        src: crumbFermentation,
        caption: 'Fermentation activity curve — temperature and starter percentage reshape the arc',
        alt: 'An interactive line chart of fermentation activity over time, redrawing as temperature and starter percentage change.',
      },
      {
        src: crumbStarter,
        caption: 'Starter ecosystem — yeast and bacteria competing for sugar over 24 hours',
        alt: 'A visualisation of a sourdough starter over 24 hours, showing yeast and bacteria populations competing for available sugar.',
      },
      {
        src: crumbEmail,
        caption: 'Sign-in email',
        alt: 'The transactional sign-in email, typeset to match the product.',
      },
    ],
  },

  {
    id: 'vittles',
    n: '02',
    name: 'Vittles',
    year: '2026',
    status: 'Launching soon',
    tag: 'Group meal planning for backpacking and camping trips.',
    cover: vittlesCover,
    coverAlt:
      "Vittles' landing hero, \"Eat well. Out there. Together.\", over a night-time campsite.",
    para:
      'Feeding six people for four days in the backcountry is a scheduling problem with weight limits. Vittles lays the trip out day by day, generates meal plans with an LLM pipeline, scales portions to the crew, and keeps dietary needs applied across the whole plan rather than one meal at a time. Trips import from several formats, and the edges — error pages, empty states, transitions — got as much attention as the happy path. Solo build across a TypeScript monorepo, product design through deployment.',
    notes: [
      {
        label: 'The problem',
        body: 'Trip food gets planned in a shared spreadsheet that nobody updates. Dietary restrictions get remembered at the trailhead, and somebody always carries too much.',
      },
      {
        label: 'Product decisions',
        body: 'Dietary needs are a property of the trip, not a filter on a recipe. Every recipe carries calories per ounce alongside calories per serving, because weight is the real currency.',
      },
      {
        label: 'Tech',
        body: 'React and TypeScript in a monorepo, Hono API, PostgreSQL, LLM pipelines for meal-plan generation and multi-format trip import.',
      },
    ],
    stack: 'React · TypeScript · Hono · PostgreSQL · LLM pipelines',
    url: null,
    cta: null,
    // Ordered as the product itself runs: the problem, then the pitch,
    // then onboarding, matching, planning, and the lists you leave with.
    shots: [
      {
        src: vittlesLanding,
        caption: 'Landing — for backpackers, car campers and every crew in between',
        alt: 'The Vittles landing page over a night campsite photograph, headed "Eat well. Out there. Together."',
      },
      {
        src: vittlesProblem,
        caption: 'The before — trip food lives in a group text until somebody unpacks at camp',
        alt: 'A mocked group message thread where three people all claim breakfast and nobody brings coffee, beside the headline "Four jars of peanut butter. No coffee."',
      },
      {
        src: vittlesPlan,
        caption: 'Trip plan — meals laid out by day, scaled to the crew',
        alt: 'The trip planner: each day of the trip in a column with breakfast and dinner assigned, and dietary counts summarised beneath.',
      },
      {
        src: vittlesChecklist,
        caption: 'Bring lists — group gear claimed by name, kept apart from personal packing',
        alt: 'A group essentials checklist where each item shows a quantity and the person who claimed it, six of six checked off.',
      },
      {
        src: vittlesOnboarding,
        caption: 'Onboarding — trip type first, because it changes every downstream constraint',
        alt: 'An onboarding step asking what kind of trip, offering backpacking or car camping as two large choices.',
      },
      {
        src: vittlesTrips,
        caption: 'Matching — three candidate trips scored against the constraints given',
        alt: 'Three suggested backpacking routes, each with drive time, mileage, elevation gain, crowd level and permit requirements.',
      },
      {
        src: vittlesRecipe,
        caption: 'Recipe detail — calories per ounce sits beside calories per serving',
        alt: 'A recipe page showing ingredients and, alongside the usual calories per serving, calories per ounce for pack weight.',
      },
    ],
  },

  {
    id: 'mealtrip',
    n: '03',
    name: 'MealTrip',
    year: '2024',
    status: 'Unshipped experiment',
    tag: 'Meal planning for every scenario at once. It got out of hand.',
    cover: mealtripCover,
    coverAlt:
      "MealTrip's My Kitchen screen: a personal recipe library shown as cards with food photography.",
    para:
      'The idea was one planner that could handle any eating situation — weeknights, dinner parties, road trips, backpacking, restrictions, budgets. Every scenario I added made the data model more general and the interface less usable, until the thing could describe any meal plan and help with none of them. I stopped before launch. Vittles is what that lesson turned into: a few scenarios taken seriously.',
    notes: [
      {
        label: 'The problem',
        body: 'I chased generality instead of a user. A planner that fits every scenario has to ask about all of them up front, which is exactly the work people wanted removed.',
      },
      {
        label: 'Product decisions',
        body: 'The useful decision was the one to stop. Scope became the design problem, and narrowing it produced a shippable product a year later.',
      },
      {
        label: 'Tech',
        body: 'React, a heavily normalised schema, and a constraint solver for portioning — most of which survived into Vittles at a tenth the size.',
      },
    ],
    stack: 'React · TypeScript · Node',
    url: null,
    cta: null,
    /*
      Ordered as the narrative runs: what it claimed to be, then the three
      surfaces that show the generality problem the write-up describes — an
      events list that has to hold trips and parties alike, a recipe library
      independent of any of them, and a dashboard reporting on all of it.
    */
    shots: [
      {
        src: mealtripLanding,
        alt: 'MealTrip landing page — Plan food for your dinner party',
        caption: 'Landing — one planner, pitched at every eating situation at once',
      },
      {
        src: mealtripEvents,
        alt: 'Your Events list showing a live backpacking trip',
        caption: 'Events — trips and parties share one model, which is where the trouble started',
      },
      {
        src: mealtripKitchen,
        alt: 'My Kitchen recipe library with imported recipes',
        caption: 'My Kitchen — a recipe library that exists independently of any trip',
      },
      {
        src: mealtripDashboard,
        alt: 'Dashboard with kitchen totals and a dietary compatibility breakdown',
        caption: 'Dashboard — dietary compatibility across the library, reported before anything was planned',
      },
    ],
  },
];

export const getProject = (id: string) => PROJECTS_V2.find((p) => p.id === id);
