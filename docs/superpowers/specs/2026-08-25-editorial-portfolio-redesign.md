# Editorial Portfolio Redesign — Product/Design Specification

**Status:** Proposed  
**Date:** August 25, 2026  
**Working title:** Product Review  
**Primary goal:** Reposition Frank Young as a product-minded designer and builder while preserving his frontend engineering credibility.

---

## 1. Overview

Redesign the portfolio from a dark, engineering-led résumé site into a restrained editorial portfolio centered on product work, design judgment, and delivered outcomes.

The new site should feel like an independent product publication: warm, composed, readable, and visually distinctive without relying on decorative effects. It should use large editorial typography, a disciplined grid, strong project imagery, captions, and thin rules to establish hierarchy.

The portfolio must support both light and dark themes. Light mode is the primary art direction. Dark mode is an equivalent expression of the same system, not a separate “developer” aesthetic.

---

## 2. Objectives

### Primary objectives

- Present product design and frontend development as the main services Frank delivers.
- Lead with selected product work rather than employment chronology.
- Demonstrate product judgment through problems, constraints, decisions, and outcomes.
- Make professional work, independent products, and experiments feel like parts of one coherent practice.
- Retain enough technical evidence to support senior frontend and design-engineering roles without allowing technology lists to dominate.
- Provide a memorable visual identity appropriate for product, design engineering, and frontend leadership opportunities.

### Secondary objectives

- Make the portfolio easy to scan in under two minutes.
- Encourage deeper reading through concise case-study introductions.
- Provide direct paths to contact information, résumé, LinkedIn, and detailed work.
- Support accessible, responsive, low-motion browsing.

### Non-goals

- The site is not a comprehensive résumé replacement.
- The site will not attempt to show every project or every technology Frank has used.
- The redesign will not use a startup-style marketing funnel, animated spectacle, glassmorphism, or heavy three-dimensional effects.
- The homepage will not contain full project case studies.

---

## 3. Positioning and Voice

### Primary positioning

Frank designs and builds digital products for complex domains. His value is the ability to move between product definition, interaction design, systems thinking, and production frontend implementation.

### Hero language

Use direct, descriptive language rather than conceptual or promotional headlines.

**Eyebrow**

> Design · prototyping · systems · implementation

**Headline**

> Product design and frontend development.

**Lead**

> I design and build clear, durable digital products for complicated domains—from electric fleets and vehicle commerce to healthcare and everyday tools.

**Primary action**

> View selected work

**Secondary action**

> About Frank

### Voice principles

- Direct before clever.
- Specific before aspirational.
- Confident without self-congratulation.
- Warm and human, with occasional dry humor.
- Technical detail appears when it explains a constraint or decision.
- Headlines describe the work or service; they do not behave like campaign slogans.

### Avoid

- “Product thinking, made tangible.”
- “Designing calm into complexity.”
- “Crafting delightful experiences.”
- “I’m passionate about…”
- “Pixel-perfect.”
- “Leveraging cutting-edge AI.”
- Tool inventories presented as proof of product ability.

---

## 4. Audience

### Primary

- Product design and design-engineering hiring managers.
- Frontend engineering managers seeking strong product and UX judgment.
- Product leaders hiring senior individual contributors who can work across disciplines.

### Secondary

- Founders and small product teams evaluating Frank for hands-on product work.
- Recruiters validating experience, role fit, and availability.
- Peers exploring Frank’s experiments and independent products.

### Visitor questions the site must answer

1. What kind of work does Frank do?
2. Can he turn a complicated domain into a clear product?
3. What did he personally contribute?
4. Does he have credible production experience?
5. How does he think and make decisions?
6. How can I contact him or view his résumé?

---

## 5. Information Architecture

### Primary navigation

- Work
- About
- Experiments
- Résumé
- Contact
- Theme toggle

On smaller screens, Work, About, and Contact remain primary. Experiments and Résumé may move into the mobile menu.

### Homepage order

1. Masthead
2. Introduction
3. Selected product work
4. Working approach or product principles
5. Selected career chapters
6. Experiments
7. Contact
8. Footer

### Recommended selected-work order

1. ChargePoint Fleet
2. Tesla Configurator
3. The Crumb
4. Kaiser healthcare tooling or Mealtrip

The final fourth project depends on the quality and availability of visual material. Kaiser should be used when the work can be described without disclosing confidential information. Otherwise, use Mealtrip as a product-scoping and refinement story.

---

## 6. Visual Direction

### Design lineage

The system should combine:

- Editorial book and magazine design for typography and pacing.
- Swiss/International Style for grid discipline and information hierarchy.
- Product catalogs and technical publications for figures, numbering, captions, and annotations.

The result should feel “almost printed,” while still behaving like a contemporary responsive product site.

### Core characteristics

- Warm paper-like light background.
- Rich ink rather than pure black.
- Expressive serif headlines.
- Neutral sans-serif body and interface text.
- Monospace used only for metadata, captions, dates, and figure labels.
- Hairline rules establish structure instead of cards.
- Large project images and editorial crops.
- Square or nearly square corners.
- Restrained oxblood accent.
- Deliberate asymmetry on desktop; clear single-column sequence on mobile.

### Explicitly avoid

- Rounded card grids.
- Technology tag clouds.
- Glowing status dots.
- Gradient-filled buttons.
- Glass surfaces and backdrop blur as a primary motif.
- Decorative terminal or IDE references.
- Full-screen empty hero space.
- Repeated reveal animations.

---

## 7. Design Tokens

### Light theme

| Token | Value | Use |
|---|---:|---|
| Paper | `#F1EEE7` | Page background |
| Ink | `#181815` | Primary text and strong rules |
| Secondary ink | `#5F5B54` | Supporting copy and metadata |
| Rule | `#C9C4B9` | Dividers and structural lines |
| Oxblood | `#8A3028` | Accent text and small graphic emphasis |
| Raised paper | `#E5E0D6` | Rare secondary surface |
| Product field | Project-specific | Large image or graphic fields only |

### Dark theme

| Token | Value | Use |
|---|---:|---|
| Paper | `#181816` | Page background |
| Ink | `#EDE8DE` | Primary text and strong rules |
| Secondary ink | `#B8B1A5` | Supporting copy and metadata |
| Rule | `#46433D` | Dividers and structural lines |
| Oxblood-light | `#E18C75` | Accessible dark-mode accent |
| Raised ink | `#25231F` | Rare secondary surface |

All final text/background combinations must be measured. Body text must meet WCAG AA, with AAA preferred. Accent colors that fail for small text may only be used for large text or non-essential graphics.

### Typography

**Display:** Newsreader  
Use for hero, section headings, project titles, pull quotes, and prominent values.

**Body/UI:** IBM Plex Sans  
Use for paragraphs, navigation, buttons, summaries, and supporting interface text.

**Metadata:** IBM Plex Mono  
Use for dates, figure numbers, short eyebrow labels, project metadata, and captions.

### Type behavior

- Body copy: 16–18px, line-height approximately 1.55–1.7.
- Long-form case-study body: maximum line length of 65–72 characters.
- Metadata: minimum 12px desktop and 13px mobile unless contrast and rendering tests support smaller text.
- Display type should use optical sizing when supported.
- Use no more than two font weights per family, preferably 400 and 500.

---

## 8. Grid, Spacing, and Page Width

### Desktop

- Twelve-column layout.
- Maximum content width: approximately 1440px.
- Outer gutter: 28–48px depending on viewport.
- Hero: approximately 70/30 split between main statement and side note.
- Featured projects: approximately 65/35 split between visual evidence and summary.
- Section boundaries use full-width horizontal rules.

### Tablet

- Six-column layout.
- Preserve asymmetric compositions where text and image remain readable.
- Reduce hero display size before collapsing the layout.

### Mobile

- Single-column reading order.
- Outer gutter: 18–20px.
- Hero side note follows the main statement.
- Project imagery precedes project summary.
- Secondary masthead metadata may be hidden.
- Minimum touch target: 44×44px.

### Vertical rhythm

- Avoid a forced `100vh` hero.
- The first selected project should be visible or clearly suggested near the initial fold on common laptop displays.
- Use generous space inside sections, but rely on rules and alignment rather than empty viewport height.

---

## 9. Homepage Components

### 9.1 Masthead

**Content**

- Frank Young wordmark.
- Optional center label: `Product Review · Vol. 01` or a simpler location/role descriptor.
- Primary navigation.
- Light/dark toggle.

**Behavior**

- May remain sticky, but should not use blur-heavy glass styling.
- Use a solid theme background with a one-pixel bottom rule.
- Navigation should be quiet and text-based.
- The active section may be indicated with an underline or accent text.

### 9.2 Theme toggle

**Control**

- Compact text-and-symbol control in the masthead.
- Label displays the destination mode: `Dark` while light mode is active and `Light` while dark mode is active.
- Use a half-filled circle or similarly restrained graphic.

**Behavior**

1. On first visit, use `prefers-color-scheme` unless a stored choice exists.
2. A manual choice overrides the system preference.
3. Persist the choice in `localStorage`.
4. Apply the theme before first paint to avoid a flash of the wrong theme.
5. Set `color-scheme` and update the browser theme color.
6. Announce the control correctly with an accessible label and pressed/state semantics.
7. Theme transitions should be short and should respect `prefers-reduced-motion`.

### 9.3 Introduction

**Left/main column**

- Service eyebrow.
- Direct headline.
- One-paragraph positioning statement.
- Link to selected work.

**Right/secondary column**

- A short working principle or personal note.
- Name, location, and availability metadata.

The side note must not compete with or obscure the descriptive hero title.

### 9.4 Selected work index

- Section title: `Selected product work`.
- Optional metadata: `Enterprise systems · consumer products · independent work`.
- Large numeric project indices: `01`, `02`, `03`, `04`.
- Do not use filter controls unless the project count materially increases.

### 9.5 Featured project

Each project feature includes:

- Project number and product/company name.
- Direct descriptive title, such as `Fleet operations platform`.
- One-sentence description of the work and problem space.
- Role.
- Focus areas or scope.
- One strong image or composed group of related artifacts.
- Figure caption.
- Link to the case study.

Project headings should identify the product or delivered capability. Narrative language belongs in the description, not the title.

### 9.6 Working approach

Replace the current toolkit section with three or four short principles. Possible topics:

- Frame the problem before expanding the interface.
- Make complex state legible.
- Prototype at the fidelity needed to answer the question.
- Carry important interaction decisions into production.

Each principle should include a concrete sentence, not a slogan.

### 9.7 Selected career chapters

- Condense the current accordion into a linear editorial timeline.
- Prioritize ChargePoint, Kaiser, Tesla, Power-One/ABB, and Fat Spaniel.
- Give each role a one- or two-sentence summary focused on product, responsibility, scale, and outcome.
- Place technologies in supporting detail or the résumé, not in the default timeline view.
- Include a clear résumé link.

### 9.8 Experiments

- Keep experiments as evidence of curiosity and range.
- Visually separate them from professional case studies.
- Use compact entries with a title, type, one-sentence description, and optional still image.
- Avoid presenting every experiment as equally important.

### 9.9 Contact

- Use a direct title such as `Contact` or `Available for product and frontend roles`.
- Include email, LinkedIn, location, and work preference.
- Do not use another promotional closing headline.

---

## 10. Case-Study Template

Each case study should use the following structure.

### Header

- Product/company.
- Direct project title.
- One-sentence summary.
- Role, dates, team, and scope.
- Hero image or representative artifact.

### Context

- What the product is.
- Who uses it.
- Why the work mattered.

### Problem

- The user or business problem.
- The relevant product and technical constraints.
- What was unclear, slow, risky, or difficult in the existing experience.

### Contribution

- Frank’s specific responsibilities.
- Key collaborators.
- Boundaries of ownership.

### Decisions

- Two to four consequential product or design decisions.
- The alternatives considered.
- Evidence or reasoning behind the selected direction.

### Outcome

- Observable product, workflow, quality, or organizational outcome.
- Quantitative metrics only when accurate and publishable.
- Qualitative outcomes must be described concretely.

### Reflection

- What Frank learned.
- What he would revisit with more time or information.

### Technical note

- Optional and short.
- Include architecture or implementation detail only when it clarifies scale, feasibility, accessibility, or a product constraint.

---

## 11. Image and Artifact Direction

- Prefer real product screens, wireframes, diagrams, and interaction states.
- Use editorial crops rather than device-mockup collages.
- Include short captions explaining what the viewer should notice.
- Use annotations to identify decisions, not merely interface features.
- Maintain consistent image proportions within each project story.
- Do not place screenshots inside glossy 3D devices unless the device itself is relevant.
- If professional imagery is unavailable, use abstracted diagrams or recreated non-confidential workflow views rather than invented product screenshots.

### Image accessibility

- Informative images require useful alt text.
- Decorative compositions use empty alt text.
- Complex diagrams require an adjacent text explanation.
- Text embedded in imagery should not be the only way information is communicated.

---

## 12. Motion and Interaction

Motion should support reading and orientation.

### Allowed

- Short theme-color transition.
- Subtle underline or rule movement on hover.
- Small image-scale or crop shift on project links.
- Gentle content reveal when it materially supports hierarchy.
- Page-transition fade between index and case study.

### Avoid

- Typing animations.
- Blinking cursors.
- Looping decorative animation.
- Large parallax movement.
- Hover effects that move cards vertically.
- Scroll-jacked sections.

All non-essential motion must be removed or substantially reduced when `prefers-reduced-motion: reduce` is active.

---

## 13. Accessibility Requirements

- Meet WCAG 2.2 AA.
- Target AAA contrast for primary body and heading text.
- Maintain visible keyboard focus using a theme-appropriate high-contrast outline.
- Preserve logical heading order and landmark structure.
- Provide a skip-to-content link.
- Ensure all navigation and theme controls work by keyboard.
- Use semantic links for navigation rather than buttons that simulate links.
- Do not rely on color alone to communicate selection or state.
- Ensure text remains usable at 200% zoom.
- Support viewport widths down to 320px without horizontal scrolling.
- Touch targets must be at least 44×44px where practical.
- Avoid body text below 16px and essential metadata below 12px.

---

## 14. Content Migration

### Retain and rewrite

- ChargePoint experience.
- Kaiser experience.
- Tesla experience.
- Power-One/ABB and Fat Spaniel clean-energy work.
- The Crumb.
- Mealtrip where useful.
- Existing experiments.
- Contact and résumé links.

### Remove from the homepage

- Decorative hero technology column.
- Typing headline animation.
- Dense technology tags in the career timeline.
- Standalone toolkit grid.
- Footer phrase `Astro · React · Tailwind · vibes`.
- Long implementation-led project descriptions.

### Move to supporting contexts

- Detailed technology lists → résumé or compact technical note.
- Complete early-career history → résumé.
- AI-assisted development tooling → relevant case-study process note.
- Extended experiment metadata → experiment detail pages.

---

## 15. Proposed Component Architecture

The exact filenames may change during implementation, but the site should converge on these responsibilities.

| Component | Responsibility |
|---|---|
| `Masthead` | Wordmark, navigation, résumé/contact link, theme control |
| `ThemeToggle` | Accessible theme selection and persistence |
| `Intro` | Service statement, lead, primary links, secondary note |
| `SelectedWork` | Ordered collection of featured projects |
| `ProjectFeature` | Project image, metadata, descriptive title, summary, case-study link |
| `Approach` | Product/design working principles |
| `CareerChapters` | Condensed professional timeline |
| `ExperimentIndex` | Curated experiments |
| `Contact` | Availability and contact methods |
| `Footer` | Copyright and essential secondary links |
| `CaseStudyLayout` | Shared case-study structure and reading width |
| `Figure` | Image, caption, alt text, and optional annotation |

### Data model changes

The project model should support:

- `title`: direct product/capability title.
- `company` or `product`.
- `summary`.
- `role`.
- `scope`.
- `year` or date range.
- `featuredImage`.
- `figures` with image, alt text, and caption.
- `caseStudyUrl`.
- `themeColor` for large graphic fields.
- Structured case-study sections.

Technology tags should not be required for homepage rendering.

---

## 16. Responsive Requirements

### 1440px and above

- Maintain a centered maximum-width editorial canvas.
- Prevent lines of text from becoming excessively long.
- Increase outer whitespace, not content scale, above the maximum width.

### 1024–1439px

- Full desktop grid.
- Two-column hero and project features.
- All primary navigation visible.

### 720–1023px

- Preserve two-column layouts when minimum text and image widths remain viable.
- Hide optional masthead edition text before reducing navigation usability.
- Reduce display type fluidly.

### Below 720px

- Single-column hero and project features.
- Collapse navigation into an accessible menu if required.
- Place imagery before project description.
- Do not shrink type solely to preserve the desktop composition.
- Ensure the theme control remains directly accessible.

---

## 17. Performance and Technical Requirements

- Preserve Astro as the rendering framework.
- Prefer static Astro components; hydrate only components that require interaction.
- Theme initialization should use a small inline script in the document head.
- Avoid hydrating the masthead solely for standard navigation.
- Optimize project images with responsive sources and explicit dimensions.
- Lazy-load below-the-fold media.
- Preload only the most important display font files and initial hero/project image.
- Avoid adding a general animation library unless existing Framer Motion usage is retained for a specific justified interaction.
- Target a Lighthouse performance score of 90+ on representative production builds.
- Target no avoidable cumulative layout shift.

---

## 18. Acceptance Criteria

### Positioning and content

- [ ] The hero title directly describes product design and frontend development services.
- [ ] Selected product work appears before career history.
- [ ] At least three featured projects include role, scope, summary, and visual evidence.
- [ ] Project titles describe the product or capability rather than using marketing language.
- [ ] The standalone skills/toolkit section has been removed from the homepage.
- [ ] Career entries emphasize product responsibility and outcomes over technologies.
- [ ] A visitor can find résumé, LinkedIn, email, and availability information without opening a case study.

### Visual system

- [ ] Light mode uses the approved warm-paper editorial direction.
- [ ] Dark mode uses an equivalent editorial palette rather than the previous royal-blue developer aesthetic.
- [ ] Newsreader, IBM Plex Sans, and IBM Plex Mono are applied according to their defined roles.
- [ ] Layout relies on grid, spacing, imagery, and rules rather than cards or decorative containers.
- [ ] The site remains coherent at 320px, 720px, 1024px, and 1440px widths.

### Theme behavior

- [ ] Theme defaults to a stored choice, then system preference.
- [ ] Manual selection persists across navigation and reloads.
- [ ] No incorrect-theme flash is visible during normal page load.
- [ ] Theme control has an accessible name and keyboard operation.
- [ ] Both themes pass contrast requirements.

### Accessibility and interaction

- [ ] Keyboard focus is visible in both themes.
- [ ] Navigation, project links, menu, and theme toggle work without a pointer.
- [ ] Reduced-motion preferences are respected.
- [ ] All project images have correct alt behavior.
- [ ] No horizontal page scrolling occurs at supported widths.
- [ ] Automated accessibility checks report no critical or serious violations.

### Quality

- [ ] Production build succeeds without TypeScript or Astro errors.
- [ ] Core pages work with JavaScript disabled except for theme switching and explicitly interactive experiments.
- [ ] The homepage contains no placeholder copy or invented product claims.
- [ ] Project descriptions have been proofread for spelling, grammar, and factual accuracy.

---

## 19. Suggested Implementation Sequence

1. Finalize homepage copy and selected-project inventory.
2. Add theme tokens and first-paint theme initialization.
3. Rebuild the masthead and introduction.
4. Create the selected-work data model and project feature component.
5. Build the first complete project feature using ChargePoint.
6. Add remaining homepage projects.
7. Replace the toolkit and accordion résumé with approach and career chapters.
8. Restyle experiments, contact, and footer.
9. Create the shared case-study layout.
10. Write and build the first full case study.
11. Run responsive, accessibility, performance, and content QA.

---

## 20. Open Content Questions

These questions do not block the visual-system implementation, but they must be resolved before final case studies are published.

- Which ChargePoint images and product details are safe to publish?
- Are Tesla configurator artifacts available, and may they be reproduced?
- Is Kaiser work suitable for a public case study, or should it remain a brief career chapter?
- Which measurable outcomes can be stated accurately for each professional project?
- Should the homepage use Mealtrip as a featured case study or reserve it for independent work?
- Should the center masthead label remain `Product Review · Vol. 01`, or use a more literal descriptor?

---

## 21. Definition of Done

The redesign is complete when the production homepage and initial case-study experience clearly position Frank around product design and frontend delivery; use the approved editorial system in accessible light and dark themes; prioritize visual, decision-oriented product evidence; and pass the responsive, accessibility, content, and build acceptance criteria above.
