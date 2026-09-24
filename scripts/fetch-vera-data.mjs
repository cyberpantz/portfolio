/**
 * Pulls the Vera Institute incarceration data into src/data/raw/.
 *
 *   node scripts/fetch-vera-data.mjs          # skips anything already there
 *   node scripts/fetch-vera-data.mjs --force  # re-downloads everything
 *
 * No dependencies — `fetch` and `node:fs` only.
 *
 * ── Why this checks what it checks ───────────────────────────────────────
 *
 * The failure mode for this kind of script is not a network error, which is
 * loud and obvious. It is getting 200 OK with the WRONG BYTES: GitHub serving
 * a rate-limit page, a login interstitial, or a "this file has moved" notice,
 * all of which are perfectly valid HTML delivered with a cheerful status code.
 * The download appears to succeed, and you discover it later when a CSV parser
 * reports that the first column is called "<!DOCTYPE html>".
 *
 * So every file declares what it should look like — content type and a rough
 * floor on size — and anything that fails those is written nowhere and
 * reported as a failure. A missing file is a problem you fix in a minute. A
 * file full of the wrong thing is a problem you fix in an afternoon, after it
 * has already misled you.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'raw');

/**
 * `refs/heads/main` rather than plain `main`.
 *
 * Both resolve today, but the explicit ref form is the one GitHub's own UI
 * generates and is less likely to be quietly redirected somewhere else. The
 * repo is `incarceration-trends` with a hyphen; several links in Vera's own
 * README still use the older underscore name, which redirects — following
 * redirects is on by default in fetch, but it is worth knowing why you might
 * see a different URL in a stack trace.
 */
const BASE = 'https://github.com/vera-institute/incarceration-trends/raw/refs/heads/main';

const FILES = [
  {
    name: 'vera-county.csv',
    url: `${BASE}/incarceration_trends_county.csv`,
    kind: 'csv',
    minBytes: 5_000_000,
    note: 'County jail 1970-2026, county prison 1983-2019. The main file.',
  },
  {
    name: 'vera-state.csv',
    url: `${BASE}/incarceration_trends_state.csv`,
    kind: 'csv',
    minBytes: 100_000,
    note: 'State-level. Worth having to cross-check county aggregates against.',
  },
  {
    name: 'vera-jail-construction.csv',
    url: `${BASE}/incarceration_trends_jail_construction.csv`,
    kind: 'csv',
    minBytes: 20_000,
    note: 'Jail construction proposals 2002-2022, and whether they passed or failed.',
  },
  {
    name: 'vera-codebook.pdf',
    url: `${BASE}/Incarceration%20Trends%20Codebook%2003-2026.pdf`,
    kind: 'pdf',
    minBytes: 100_000,
    note: 'Column definitions. Not optional — guessing at columns is how you visualise the wrong field.',
  },
];

/* A CSV and a PDF have recognisable first bytes. An error page does not. */
const looksRight = (kind, buf, contentType = '') => {
  const head = Buffer.from(buf.subarray(0, 512)).toString('utf8');
  if (/<!doctype html|<html[\s>]/i.test(head)) return 'got an HTML page, not a file';
  if (kind === 'pdf') {
    if (!head.startsWith('%PDF-')) return 'missing the %PDF- signature';
  } else if (kind === 'csv') {
    if (!/^[\w"',;.\- ]+[,;\t]/.test(head)) return 'first line does not look like a delimited header';
    if (/^\s*[{[]/.test(head)) return 'looks like JSON, not CSV';
  }
  if (contentType.includes('text/html')) return `served as ${contentType}`;
  return null;
};

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function grab(f, force) {
  const dest = join(OUT, f.name);

  if (!force) {
    try {
      const s = await stat(dest);
      if (s.size >= f.minBytes) {
        console.log(`  ·  ${f.name.padEnd(28)} already here (${mb(s.size)})`);
        return true;
      }
      console.log(`  !  ${f.name.padEnd(28)} on disk but only ${mb(s.size)} — refetching`);
    } catch {
      /* not there yet, which is the normal path */
    }
  }

  process.stdout.write(`  →  ${f.name.padEnd(28)} fetching… `);
  let res;
  try {
    res = await fetch(f.url, { redirect: 'follow' });
  } catch (err) {
    console.log(`FAILED\n     ${err.message}`);
    return false;
  }
  if (!res.ok) {
    console.log(`FAILED — HTTP ${res.status} ${res.statusText}`);
    return false;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const wrong = looksRight(f.kind, buf, res.headers.get('content-type') ?? '');
  if (wrong) {
    console.log(`FAILED — ${wrong}`);
    console.log(`     nothing written. Open the URL in a browser and see what it serves:`);
    console.log(`     ${f.url}`);
    return false;
  }
  if (buf.length < f.minBytes) {
    console.log(`FAILED — ${mb(buf.length)}, expected at least ${mb(f.minBytes)}`);
    return false;
  }

  await writeFile(dest, buf);
  console.log(`ok (${mb(buf.length)})`);
  return true;
}

const force = process.argv.includes('--force');

await mkdir(OUT, { recursive: true });
console.log(`\nVera Institute incarceration data → src/data/raw/${force ? '  (--force)' : ''}\n`);

const results = [];
for (const f of FILES) results.push([f, await grab(f, force)]);

const failed = results.filter(([, ok]) => !ok);
console.log('');
for (const [f] of results) console.log(`     ${f.name.padEnd(28)} ${f.note}`);

if (failed.length) {
  console.log(`\n${failed.length} of ${FILES.length} failed. Nothing partial was written.\n`);
  process.exit(1);
}
console.log(`\nAll ${FILES.length} files present. Raw data is gitignored — it is reproducible from here.\n`);
