# Prompt — Portfolio Refresh: Visual & Voice Exploration Screens

Use this prompt to have an LLM produce a set of **self-contained, browser-viewable HTML mockups** that explore art direction, typographic/color systems, and copy voice for a personal portfolio refresh. It reproduces the three exploration screens described below. Paste everything between the rules into your model of choice.

---

## ROLE

You are a senior product/brand designer *and* front-end engineer helping refresh a personal portfolio. You have taste, you know design history, and you write copy. You produce **real, viewable HTML mockups** — not descriptions — so the human can *feel* each direction at full scale.

## PERSON THE SITE IS FOR

- **Frank Young** — product-focused frontend engineer, San Francisco Bay Area, 20+ years.
- React / TypeScript across consumer commerce, healthcare, clean energy, operational SaaS.
- Recent: Staff Frontend Engineer at **ChargePoint** (EV fleet charging tools, real-time dashboards) — role has ended, now independent.
- Notable roles: **Tesla** (vehicle configurator tech lead, 40+ markets), **Kaiser Permanente** (UI architect), Power-One/ABB, Fat Spaniel (energy data-viz).
- Now building AI-assisted products solo: **The Crumb** (AI sourdough diagnosis from a photo, Claude Vision), a group trip-planning tool, and a portfolio "lab" of playful experiments (a Simon-style memory game, a wage-gap visualizer, a WebGL weather-mood scene).
- Spec-first / AI-assisted development (Claude Code, Codex, Cursor, Copilot).

## GOALS & CONSTRAINTS (the human's own words, paraphrased)

- **Primary goal: land a full-time frontend role.** Keep freelance/contract and indie-AI-builder as *supporting* layers, not the headline.
- **Reinvent**, don't reskin — layout and experience are on the table.
- **Mood: refined-editorial meets quirky-nerdy.** Beautiful, easy on the eyes, very readable, clear — but with personality.
- Keep the existing work history and experiments; the **résumé/positioning content gets a serious overhaul** and updated copy.
- **Must NOT read like an AI-generated portfolio.** No Inter + violet gradient + glassmorphism + emoji-header clichés. Ground every type/color choice in a **named, pre-AI design lineage** (real designers / studios / movements).
- Editorial, clean, "almost meant for print." A bit techie is welcome.
- **Non-negotiable accessibility:** every text/background pairing must meet **WCAG AA (≥4.5:1)**, target **AAA (≥7:1)** for body and headings; restrict low-contrast accent colors to large-text/graphic use only and say so. Body type ≥16–18px, meta text ≥14px, generous line-height.
- **Voice: has personality — think witty, warm, and human, "someone you'd want to spend time with."** Never boastful; competence implied, not announced. Beyond that, **interpret freely** — the exact register (dry, playful, deadpan, earnest-with-a-wink, something else) is yours to invent. Don't converge on a single "correct" tone; surprise the reader.

## OUTPUT FORMAT (all three screens)

- Produce **three separate self-contained HTML files** (inline `<style>`, Google Fonts via `<link>`, no build step). Each opens directly in a browser.
- Use **real content** from the person above — never lorem ipsum. Same copy across variants within a screen so the *system/voice* is what's being compared.
- Where a screen compares options, put a **fixed tab bar at the top (`1 | 2 | 3 | …`)** that switches between **full-viewport** mockups via a tiny vanilla-JS show/hide. No thumbnails — each option must render full-screen so type and spacing read at true scale.
- Clean, restrained visuals. Show, in each mockup, at minimum: a nav, a hero (kicker + headline + lead + CTAs), and enough supporting content to feel the system.

---

## SCREEN 1 — ART DIRECTIONS (mood spread)

Three distinct hero mockups exploring overall *mood*, each labeled with its intent. Purpose is emotional direction, not final pixels. Suggested spread (adapt, keep them genuinely distinct):

1. **Warm editorial (light)** — cream paper, an expressive serif (e.g. Fraunces), one warm accent. Premium print-magazine feel.
2. **Elevated dark** — a refined take on a dark site: richer black, subtle grain, a distinctive accent (amber, not royal blue). Product-studio energy. *(Include as the "evolution, lower-risk" option.)*
3. **Terminal / nerdy-playful** — monospace/IDE aesthetic with tasteful syntax-highlight accents, but a refined display face for headlines so it stays beautiful.

For each: a short caption naming the direction, what it signals, and its trade-off.

## SCREEN 2 — DESIGN SYSTEMS (full-screen, tabbed, lineage-grounded)

**This is the centerpiece.** A tabbed, full-screen set of **complete design systems**, each explicitly anchored to a **named pre-AI design lineage**, each showing a real hero + supporting content, and each displaying its **live WCAG contrast ratios** on a small palette bar. Same understated copy in all tabs. Suggested systems (keep the lineage citations; swap fonts only for close, freely-available equivalents):

1. **"The Grid"** — *Swiss / International Typographic Style (Müller-Brockmann, Vignelli).* Grotesque display (e.g. Archivo), mathematical grid, hairline rules, mono captions, one signal red. Rational, techie.
2. **"Paper & Ink"** — *Editorial book design (Tschichold / Penguin, NYT literary).* Fraunces display (its wonky optical axis = the nerdy wink) over a serif body (Newsreader), warm cream, generous leading. Most print-like.
3. **"Engineered Editorial"** — *IBM Plex superfamily (Mike Abbink & Bold Monday).* One family across Serif / Sans / Mono; a mono "spec sheet" side panel. Techie, structured, strong "a real team designed this" story.
4. **"Bold Editorial"** — *Bloomberg Businessweek / Richard Turley.* Huge heavy grotesque headline, an electric accent underline, magazine-cover energy. The loudest / most polarizing.

Each tab: styled nav + full hero (kicker, headline, lead, two CTAs) + supporting block (stat strip, spec panel, or footnote line) + palette swatches with hex and **contrast ratio + AA/AAA label**. Label accent colors that only pass at large sizes as "large/graphic only."

## SCREEN 3 — VOICE EXPLORATION (full-screen, tabbed)

Explore **three genuinely different voice directions of your own invention**, in a neutral editorial frame, so the human can react to distinct personalities rather than three notches on one dial. Don't reproduce a prescribed "dry vs. playful vs. too-far" ladder — that's cloning, not creativity. Instead, invent three *different* takes on a witty, human, non-boastful voice: they might differ in register, rhythm, point of view, running motif, or what they choose to be funny about. Make them feel written by a person with range, not generated from a template.

Each tab should render the same content surfaces so the voice is what varies: hero (kicker + headline + lead), an About paragraph, a couple of work bullets, a project blurb (The Crumb), and microcopy (CTAs + an availability line). End each tab with a one-line honest **note on the trade-off** that direction makes (e.g. what it wins, what it risks with a hiring manager).

In your closing summary, say which direction *you'd* pick and why — but treat that as an opinion, not a foregone conclusion.

---

## RAW MATERIAL (facts to write from — invent your own lines, do NOT copy these)

Write all copy fresh. The list below is factual raw material and possible comedic angles — **not lines to reuse**. If your output echoes these phrasings, you've cloned instead of created; find your own.

- Facts: 20+ years frontend; real-time EV fleet dashboards (ChargePoint); Tesla vehicle configurator across 40+ markets; healthcare tooling (Kaiser); energy data-viz; now building AI products solo.
- Possible angles to riff on (pick your own, or find better): the longevity ("has been doing this since <old web thing>"), the obsession with tiny details, the gap between "impressive-sounding employer" and "it was mostly me and a linter," The Crumb as "AI judges my sourdough," experiments as a place to be weird.
- Practical surfaces that need copy: a kicker/eyebrow, a hero headline + lead, an About paragraph, work bullets, a project blurb, and microcopy (primary/secondary CTA + an availability line).

## DELIVERABLE

Three HTML files: `art-directions.html`, `design-systems.html`, `voice-exploration.html`. After the files, give a short written recommendation: which design system and which of *your* voice directions you'd pick for a portfolio whose #1 job is landing a full-time frontend role while staying memorable — and why. Treat it as an opinion, not the only answer.
