/**
 * Captures the exploration thumbnails from the REAL experiments.
 *
 *   pnpm build && pnpm preview     # in one terminal
 *   pnpm shots                     # in another
 *
 * Against the BUILT site, not the dev server. Two reasons, both learned
 * the hard way: Vite's dependency cache goes stale after a long editing
 * session and starts answering 504 (Outdated Optimize Dep), which makes
 * an island fail to hydrate and screenshots a blank page; and the dev
 * server is not what visitors get anyway.
 *
 * Most of these experiments open on a menu — a difficulty picker, a
 * category list, a start button — so a naive screenshot captures a
 * chooser rather than the thing itself. Each recipe below therefore
 * drives the experiment to its most characteristic MOMENT first.
 *
 * Output: src/assets/explorations/{id}.png at 1600x1200 (4:3 at 2x), which
 * is the ratio the project covers already use. They go in src/assets
 * rather than public/ so astro:assets optimises them into responsive webp
 * at build time.
 *
 * Every recipe fails loudly. A selector that stops matching is this
 * experiment having been restructured, and a thumbnail quietly showing
 * the wrong thing is worse than a build that stops.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/assets/explorations');
const BASE = process.env.BASE ?? 'http://localhost:4321';

/** 4:3 at 2x. The grid renders these around 330px wide, so this is ample. */
const RATIO = 4 / 3;

const click = async (page, text) => {
  const el = page.getByRole('button', { name: text, exact: false }).first();
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await el.click();
};

/**
 * A 4:3 clip built around a real element box, clamped to the viewport.
 *
 * The first version of this used fixed pixel clips, on the assumption
 * that each experiment centres its content in the viewport. Four of the
 * six do not, and the thumbnails came back sliced mid-word or looking at
 * empty background. Framing from getBoundingClientRect is the difference
 * between composing a picture and cropping a guess.
 */
function clipAround(box, view, { pad = 0, shiftY = 0, height, fitWidth = false } = {}) {
  /*
   * Fit INSIDE the content box, never grow past it.
   *
   * This used to take the larger of the box's height and the height a
   * 4:3 crop of its full width would need — which for anything wide made
   * the crop taller than the content itself, so the frame reached past
   * the experiment and pulled in the site header. A thumbnail with the
   * page chrome in it is a screenshot, not a composition.
   */
  /*
   * fitWidth derives the height from the MEASURED box width, so the
   * window covers the content exactly. Hand-picking a height means
   * hand-guessing how wide the column reflows to at a given viewport,
   * and three guesses in a row all sliced the headline.
   */
  let h = fitWidth ? (box.width + pad * 2) / RATIO : (height ?? box.height + pad * 2);
  h = Math.min(h, view.height);
  let w = Math.min(h * RATIO, view.width);
  h = w / RATIO;
  let x = box.x + box.width / 2 - w / 2;
  let y = box.y + box.height / 2 - h / 2 + shiftY;
  x = Math.max(0, Math.min(view.width - w, x));
  y = Math.max(0, Math.min(view.height - h, y));
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

/**
 * Waits until Fowl Play's field is actually worth photographing.
 *
 * A fixed sleep does not work here: the chef takes three hits and the run
 * length is not deterministic, so the same wait captured a busy field on
 * one attempt and a game-over screen on the next. This polls for a field
 * that still exists AND has enough sprites in it to read as chaos, and
 * gives up honestly so the caller can restart rather than shoot a defeat
 * message.
 */
/**
 * One recipe per exploration: how to reach the moment, and what to frame.
 *
 * `frame` names the element the picture is composed around — the play
 * field, the device, the question card — not the page.
 */
const RECIPES = {
  clickwheel: {
    note: 'The device leaning, screen lit, on Now Playing.',
    frame: '[class*="_mount_"]',
    pad: 54,
    // Up off the wall label, which sits below the device in the stage.
    shiftY: -34,
    async drive(page) {
      await page.waitForTimeout(3400);                   // boot sequence
      const pod = await page.locator('[class*="_pod_"]').boundingBox();
      /*
       * The pointer must stay INSIDE the pod. useWheelInput arms the
       * keyboard on hover, so parking it outside — which the first
       * version did, to get a stronger lean — silently disabled every
       * key press and the shot came back on the menu.
       */
      await page.mouse.move(pod.x + pod.width * 0.86, pod.y + pod.height * 0.22);
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');                // Music
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');                // first track -> Now Playing
      await page.waitForTimeout(1400);
    },
  },

  'weather-vibe': {
    note: 'The street canyon and the vanishing point.',
    frame: 'canvas',
    // Inside the canvas, below the location readout along its top edge and
    // above the sound prompt along its bottom.
    height: 600,
    shiftY: 20,
    async drive(page) {
      await page.waitForSelector('canvas', { timeout: 20000 });
      await page.waitForTimeout(6000);                   // let the scene settle
    },
  },

  'kitchen-dodgeball': {
    note: 'The title card — the one vivid thing in the grid.',
    /*
     * The TITLE screen, not the game.
     *
     * Every other recipe here drives past the menu on the principle that
     * a chooser is not the work. This one is the exception, and the
     * reason is honest: the playfield is a black rectangle with a few
     * sprites on it, and at 330px wide that reads as an empty card no
     * matter how busy the board gets. The title screen is a designed
     * thing — an emoji row, the wordmark, and the premise in one line —
     * and it is the only vivid colour in a grid of dark tiles.
     *
     * It also deletes the most fragile machinery in this file. Capturing
     * play meant polling sprite density and restarting runs that died
     * early, because nobody is holding the arrow keys. A title card is
     * just there.
     */
    frame: 'main div.text-center.mb-12',
    /*
     * 320x240, landed between two hard edges.
     *
     * The block is 304 wide, so the window cannot be narrower without
     * clipping the emoji row — which sets the height at 4:3. Vertically
     * it has to start below the site header (page y 84) and stop before
     * the difficulty cards (page y 328), or the card tops get sliced and
     * the thumbnail looks unfinished. 240 tall shifted 30 down lands at
     * 84..324: header gone, cards excluded, and SELECT DIFFICULTY sits
     * whole on the bottom line.
     */
    height: 240,
    shiftY: 30,
    // 320x240 at 5x = 1600x1200, matching the rest of the set.
    scale: 5,
    async drive(page) {
      await page.waitForTimeout(1200);
    },
  },

  'wage-gap': {
    note: 'The ticker climbing beside the comparison figures.',
    /*
     * Framed on the TICKER COLUMN, not the row.
     *
     * Centring a 4:3 window on the full-width row put its left edge
     * inside the flip counter and sliced the digits — the counter is the
     * piece, so cutting it is the one thing the crop must not do.
     * Composing around the column instead pins the window to the left
     * edge and lets the comparison figures fall into whatever space is
     * left over.
     */
    frame: 'main div.flex.flex-col > div',
    viewport: { width: 1080, height: 860 },
    height: 660,
    shiftY: 20,
    async drive(page) {
      await page.waitForTimeout(6000);                   // let the money stack up
    },
  },

  quizzolator: {
    note: 'The answered question, zoomed to the two specimens.',
    /*
     * ANSWERED, and zoomed in.
     *
     * The unanswered question is just two identical words: the whole
     * point — that one is kerned — is invisible until the reveal puts a
     * checkmark and the DEFAULT METRICS / KERNED labels on them. And the
     * first crop framed the entire card, which left the type small and
     * half the frame empty. A thumbnail has one job at 330px wide, so it
     * should be a zoom into the interesting part rather than a polite
     * record of the whole screen.
     */
    frame: 'main div.mx-auto',
    viewport: { width: 720, height: 900 },
    // Height derived from the column's measured width, so the window
    // covers it exactly rather than relying on a guess about reflow.
    fitWidth: true,
    shiftY: 30,
    async drive(page) {
      await click(page, 'Typography');
      await page.waitForTimeout(400);
      await click(page, 'Begin');
      await page.waitForTimeout(1500);
      // Answer it. Either specimen reveals both labels; the kerned one
      // takes the checkmark, which is the detail worth photographing.
      const specimens = page.locator('main button').filter({ hasText: /AVATAR/ });
      await specimens.nth(1).click();
      await page.waitForTimeout(1600);
    },
  },

  'pattern-match': {
    note: 'The board mid-sequence.',
    // The play area is 1200x338 — far wider than 4:3 — so this frames a
    // window on it rather than trying to fit the whole strip in.
    /*
     * A narrower viewport so the board reflows to something a 4:3 window
     * can hold whole — at full width the cards ran past both edges — and
     * lifted off the quit button that sits under it.
     */
    frame: 'main div.grid',
    viewport: { width: 820, height: 900 },
    height: 545,
    shiftY: -26,
    async drive(page) {
      await click(page, 'Hard');
      await page.waitForTimeout(2600);
    },
  },
};

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--autoplay-policy=no-user-gesture-required',
    // Headless Chromium has no GPU; without this the Three.js scene never
    // gets a context and the page screenshots black.
    '--enable-unsafe-swiftshader',
  ],
});

const only = process.argv[2];
const ids = only ? [only] : Object.keys(RECIPES);
const failures = [];

for (const id of ids) {
  const recipe = RECIPES[id];
  if (!recipe) throw new Error(`No recipe for "${id}". Known: ${Object.keys(RECIPES).join(', ')}`);

  const context = await browser.newContext({
    /*
     * Some boards are far wider than 4:3 at any height that fits the
     * window, so a centred crop slices cards in half. Capturing those in
     * a narrower viewport lets the layout reflow to something a 4:3
     * window can hold whole.
     */
    viewport: recipe.viewport ?? { width: 1280, height: 800 },
    /*
     * 2 suits a crop that is already ~800 CSS px wide. A tight crop needs
     * more: Fowl Play's window is only 320 CSS px across, which at 2 gave
     * a 640px source — below the 840px variant astro:assets is asked to
     * emit, so that card shipped soft while every other one was sharp.
     */
    deviceScaleFactor: recipe.scale ?? 2,
    // Weather Vibe resolves a real city from this. Without the grant it
    // waits on a permission prompt that never arrives in headless.
    permissions: ['geolocation'],
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));

  try {
    await page.goto(`${BASE}/explorations/${id}`, { waitUntil: 'networkidle', timeout: 45000 });
    await recipe.drive(page);

    const target = page.locator(recipe.frame).first();
    await target.waitFor({ state: 'visible', timeout: 10000 });
    const box = await target.boundingBox();
    if (!box) throw new Error(`"${recipe.frame}" matched nothing with a box — has this page been restructured?`);
    const clip = clipAround(box, page.viewportSize(), recipe);

    /*
     * Last check before the shutter. Fowl Play's field empties as fast as
     * it fills, so a busy moment found during drive() can be gone by the
     * time framing finishes — the shot came back showing one banana.
     */
    if (recipe.ready) {
      const deadline = Date.now() + 40000;
      while (!(await recipe.ready(page))) {
        if (Date.now() > deadline) throw new Error('never became ready to photograph');
        await page.waitForTimeout(250);
      }
    }

    await page.screenshot({ path: resolve(OUT, `${id}.png`), clip });
    console.log(`  ✓ ${id.padEnd(18)} ${recipe.note}`);
    if (errors.length) console.log(`    (page errors: ${errors[0]})`);
  } catch (err) {
    /*
     * Leave evidence. A recipe fails because the experiment reached a
     * state it was not driven to — a game that ended early, a menu that
     * did not advance — and the only way to tell which is to see the
     * page as it stood when the selector missed.
     */
    const shot = resolve(OUT, `FAILED-${id}.png`);
    try {
      await page.screenshot({ path: shot });
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 120);
      console.log(`  ✗ ${id.padEnd(18)} ${String(err).split('\n')[0]}`);
      console.log(`    page said: "${text}"`);
      console.log(`    debug shot: ${shot}`);
    } catch {
      console.log(`  ✗ ${id.padEnd(18)} ${String(err).split('\n')[0]} (and could not screenshot)`);
    }
    failures.push(`${id}: ${String(err).split('\n')[0]}`);
  }
  await context.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} of ${ids.length} failed:`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log(`\n${ids.length} thumbnails written to src/assets/explorations/`);
