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
import crumbOnboarding from '../assets/projects/crumb-onboarding.png';
/* crumb-anatomy.png is deliberately NOT imported. It is the source the 4:3
   crumb-cover.png was composed from — kept in the folder so the cover can be
   regenerated, but the screen itself stays out of the gallery. Astro only
   emits assets that are imported, so an unreferenced file costs nothing. */
import crumbBake from '../assets/projects/crumb-bake.png';
import crumbVerdict from '../assets/projects/crumb-verdict.png';
import crumbFermentation from '../assets/projects/crumb-fermentation.png';
import crumbStarter from '../assets/projects/crumb-starter.png';
import crumbEmail from '../assets/projects/crumb-email.png';
/* sizer-cover.png is a composed 4:3 window on the visualiser panel of
   sizer-visualizer.png — the bag drawn inside the airline's published frame
   with its three dimensions called out. Cropped around the drawing rather than
   centre-cropped, because the centre of that screenshot is empty panel. */
import sizerCover from '../assets/projects/sizer-cover.png';
import sizerLanding from '../assets/projects/sizer-landing.png';
import sizerCatalogue from '../assets/projects/sizer-catalogue.png';
import sizerVisualizer from '../assets/projects/sizer-visualizer.png';
import sizerCheckTrip from '../assets/projects/sizer-check-trip.png';
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
    coverAlt:
      'An annotated photograph of a sourdough crumb cross-section, with six numbered markers labelling the crust, alveoli, cell walls and air pockets.',
    para:
      'Sourdough has a slow feedback loop — change one variable, wait, observe, repeat. For new bakers it can be overwhelming and hard to know what went wrong when your loaf doesn\'t turn out as expected. With TheCrumb, users can log a bake, photograph the loaf, and get a structured read on timing, fermentation, crust and shaping, scored against the numbers, starter, and ingredients you actually used. in addition to the journal, I build several useful educational baking related experiments — a fermentation activity curve, a live starter ecosystem, a bulk fermentation simulator — that help explain why the loaf turned out the way it did. Owned product from start to finish. Product, design, front end, backend and deployment.',
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
        src: crumbOnboarding,
        caption:
          'First run — two of the three setup steps are marked optional, and the one that produces a diagnosis is marked start here',
        alt: "The Crumb's signed-in home: a welcome headline, three setup cards for a starter, a recipe and a first bake, and Lev the sourdough copilot below with an ask box.",
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
    id: 'sizer',
    n: '02',
    name: 'Sizer',
    year: '2026',
    status: null,
    tag: 'Will your carry-on fit? Sizer answers the question for every airline, every bag, every leg of your trip.',
    cover: sizerCover,
    coverAlt:
      "Sizer's size visualiser: a carry-on drawn inside the dark outline of an airline's published cabin limit, with its width, height and depth called out.",
    para:
      ' I was searching Google for a carry-on under 21 inches. It returned a 29-inch checked bag, a neck pillow, packing cubes, and a suitcase whose own listing gave three different sets of dimensions in three different places. I tried "EU cabin friendly" and was shown a golf travel case. Somewhere in there I stopped shopping and started taking notes. I discovered that "carry-on" is not a size. The airlines here publish seventeen different limits, from 40 cm to 61 cm on the longest side. And a product listing may or may not be counting the wheels, which are exactly the part a gate agent will measure. Sizer answers what the search box cannot: your bag, your airline, the fare you actually clicked, across a growing list of airlines and bags. It also names the leg of your trip that ruins it, which is never the leg you were worried about.',
    notes: [
      {
        label: 'The problem',
        body: 'Everyone answering this question is trying to sell you a bag. The affiliate roundups copy dimensions off retail listings. The airlines publish the truth and then bury it three clicks into a fare table. Five of them sell a cheapest ticket that includes no cabin bag whatsoever, a detail they are in no rush to lead with. Nobody was answering the specific question, because answering there\'s no incentive to do so. I built Sizer to show the answer in a way that makes the gap between a brochure figure and a gate visible.',
      },
      {
        label: 'Product decisions',
        body: 'Establish trust. Make it Beautiful, but not pretentious. Always show sources. Show links to the airline and bag manufacturers when available. Allow for custom bags. Keep the design clean and functional. Build something useful, then think about how to monetization. ',
      },
      {
        label: 'Process',
        body: 'I vibe coded this thing in less than a week.  Step 1: Establish clear specs and product vision. Step 2: Establish design direction;  generate a round of mockups. Step 3: Write technical specs and implementation plans that refer to mockups, Step 4: Iterate. Rinse. Repeat. ',
      },
      {
        label: 'Tech',
        body: 'Astro with Preact islands, Tailwind, ThreeJS for the luggage visualization, deployed static to Cloudflare Workers. The sizing engine is a standalone module with over 600 tests!',
      },
    ],
    stack: 'Astro · TypeScript · Preact · Tailwind · Cloudflare Workers',
    /* Temporary workers.dev host. Swap for the real domain, or set both of these
       to null until there is one — mealtrip shows the null case rendering fine. */
    url: 'https://sizer.phranque-y.workers.dev',
    cta: 'Visit Sizer',
    /*
      Ordered as the argument runs: the question, the shelf that answers it at a
      glance, the single screen that makes the gap between a brochure figure and
      a gate visible, and finally the trip-level answer no per-airline lookup can
      give.
    */
    shots: [
      {
        src: sizerLanding,
        caption: 'Landing — three ways in, because people arrive with different questions',
        alt: 'Sizer\'s landing page: the headline "Will your carry-on actually fit?" above three entry points — I have a bag, I am buying one, I am flying somewhere.',
      },
      {
        src: sizerCatalogue,
        caption: 'Catalogue — shelved by how widely a bag fits, not by brand or price',
        alt: 'The bag catalogue headed "Carry-on bags, ranked by how many airlines they fit", with type filters and a "Goes anywhere" shelf of bags clearing at least 80% of airlines.',
      },
      {
        src: sizerVisualizer,
        caption: 'Bag detail — the bag drawn inside the airline\'s own frame, wheels included',
        alt: "A Travelpro spinner checked against Austrian Airlines: outside and packing dimensions on the left, and the bag drawn inside the airline's published limit with width, height and depth called out.",
      },
      {
        src: sizerCheckTrip,
        caption: 'Trip checker — every leg, and the one that actually decides',
        alt: 'The trip checker with a flight and a bag entered, returning a "Tight" verdict, the airline\'s strictness score, a chart of the bag against the cabin limit on each axis, and how much weight is left to pack.',
      },
    ],
  },

  {
    id: 'vittles',
    n: '03',
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
    n: '04',
    name: 'MealTrip',
    year: '2024',
    status: 'Unshipped experiment',
    tag: 'Meal planning for every scenario at once. It got out of hand.',
    cover: mealtripCover,
    coverAlt:
      "MealTrip's My Kitchen screen: a personal recipe library shown as cards with food photography.",
    para:
      'The idea started off reasonably. I wanted to make a group food planner that was more fun than a spreadsheet. I had just downloaded Claude and started jamming; one poorly defined prompt after another. It was so fun. Add a new feature. Animate some things that nobody expects to be animated. Pack the delightful interface elements in everywhere. It became one planner that could handle any eating situation — weeknights, dinner parties, road trips, backpacking, restrictions, budgets. Confetti. Animal sounds. Gamification for no good reason.Every scenario I added made the data model more general and the interface less usable, until the thing could describe any meal plan and help with none of them. I stopped before launch. Vittles is what that lesson turned into: a few scenarios taken seriously, and more niche. This project taught me an important lesson about scope, and that planning is more important than ever when you are using a generative model to build a product.',
    notes: [
      {
        label: 'The problem',
        body: 'I got caught up in the newbie phase of ai magic. I chased novelty instead of product definition. I was so amazed that I could build things that would have previously taken me a week in a hour or two.',
      },
      {
        label: 'Product decisions',
        body: 'The useful decision was the one to stop. This project was part of the journey, a learning experience, not a product.',
      },
      {
        label: 'Tech',
        body: 'React, Tailwind, NextJS - deployed on Vercel',
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
