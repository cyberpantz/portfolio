# Working in this repo

## Comments

A comment earns its place by stopping a future edit from breaking something.
Nothing else does.

Keep:

- A constraint that is not visible in the code. *"The stage is aria-hidden,
  which covers its whole subtree, so the dialog must be portalled out."*
- A non-obvious "must not". *"Labels move, lines do not."*
- A short orientation at the top of a file — what it is, two or three lines.

Delete:

- Change history. What the code used to be, which version was first, what was
  wrong with the old one. Git has it.
- Who asked for something, and when.
- Restating the line below in prose.
- Justifying a decision that nobody disputes.

A file over roughly 20% comment lines is a signal to cut, not a target to hit.

## Prose on the site

The copy is read by people who have not read the data, the sources, or
anything else on the page yet.

- No sentence that describes what the piece is doing. "What is new here is the
  shape", "every chart after this one points somewhere else" — filler dressed
  as transition, and it tends to sit on top of something inaccurate.
- No telling the reader what they already know, expect, or carry around.
- No word from the pipeline. "Ungrouped", "panel", "band" need translating.
- Prefer a concrete pair of numbers to an abstraction. "A county of a few
  thousand jailed at 2.6 times the rate of a county of a million" beats "a
  gradient that was flat and is now steep."
- Cut any clause that survives its own deletion.

## Numbers

Every figure in the copy is computed from the data file, never typed. The Tilt
suite enforces this for its own prose; do the same elsewhere.

## Verification

`astro build` and `astro check` cannot run in the sandbox (native rollup
binary). Use `npx tsc --noEmit` plus the per-experiment render suites, e.g.
`bash src/experiments/tilt/__tests__/run.sh`.

When a bug is found, add the check that would have caught it — in the suite,
not in a comment.
