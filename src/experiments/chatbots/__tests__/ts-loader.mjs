/**
 * Resolve extensionless relative imports to .ts, so the verification
 * script can run the real source under `node --experimental-strip-types`
 * without the source having to carry bundler-specific extensions.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/*
 * "Has an extension" cannot be decided by the presence of a dot.
 *
 * `./care.script` ends in `.script`, which looked like an extension to
 * the old regex, so the loader passed it straight through and node
 * could not find it — a module named with a dotted convention defeats
 * the heuristic entirely. Existence on disk is the only honest test, so
 * that is what this asks now.
 */
export async function resolve(specifier, context, next) {
  const resolves = (spec) => {
    try {
      return existsSync(fileURLToPath(new URL(spec, context.parentURL)));
    } catch {
      return false;
    }
  };
  if (specifier.startsWith('.') && !resolves(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const candidate = new URL(base.href + ext);
      if (existsSync(fileURLToPath(candidate))) {
        return next(pathToFileURL(fileURLToPath(candidate)).href, context);
      }
    }
  }
  return next(specifier, context);
}
