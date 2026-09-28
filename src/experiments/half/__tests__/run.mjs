/**
 * Bundles the suite with esbuild so the real components run, not a mock of
 * them. A script rather than the CLI because the article is imported the
 * Vite way (article.md?raw), which esbuild needs a plugin to understand.
 *
 * HALF_ESBUILD points at a different esbuild build when the one in
 * node_modules is for another platform (as in a Linux sandbox on a Mac repo).
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const esbuild = await import(process.env.HALF_ESBUILD || 'esbuild');
const dir = dirname(fileURLToPath(import.meta.url));
const out = resolve(dir, '.bundle.cjs');

const raw = {
  name: 'vite-raw',
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.replace(/\?raw$/, '')), namespace: 'raw' }));
    b.onLoad({ filter: /.*/, namespace: 'raw' }, async (a) => ({
      contents: (await import('node:fs')).readFileSync(a.path, 'utf8'), loader: 'text',
    }));
  },
};

await (esbuild.default ?? esbuild).build({
  entryPoints: [resolve(dir, 'render.test.tsx')],
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', target: 'node20',
  loader: { '.css': 'empty', '.json': 'json' },
  outfile: out, logLevel: 'warning', plugins: [raw],
  absWorkingDir: resolve(dir, '../../../..'),
});
try {
  execFileSync(process.execPath, [out], { stdio: 'inherit', cwd: resolve(dir, '../../../..') });
} catch {
  rmSync(out, { force: true });
  process.exit(1);
}
rmSync(out, { force: true });
// A crash is not a pass: absence of this line is the signal.
console.log('\nHALF SUITE PASSED');
