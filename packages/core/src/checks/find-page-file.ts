import { dirname, join, relative, sep } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';

const PAGE_BASENAMES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js']);
const LAYOUT_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist']);

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function isParallelSlot(segment: string): boolean {
  return segment.startsWith('@');
}

function urlSegments(relativeDir: string): string[] {
  if (!relativeDir || relativeDir === '.') return [];
  return relativeDir
    .split(sep)
    .filter((segment) => segment && !isRouteGroup(segment) && !isParallelSlot(segment));
}

function targetSegments(routePath: string, localePrefix: string): string[] {
  const segments: string[] = [];
  if (localePrefix) segments.push(localePrefix);
  for (const segment of routePath.split('/')) {
    if (segment) segments.push(segment);
  }
  return segments;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function* walkPageFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walkPageFiles(full);
    } else if (PAGE_BASENAMES.has(entry)) {
      yield full;
    }
  }
}

/**
 * Resolve a Next.js App Router route path to its `page` file, ignoring route
 * groups `(group)` and parallel-route slots `@slot`, which do not appear in the URL.
 */
export function findPageFile(
  appDir: string,
  routePath: string,
  localePrefix = '',
): string | undefined {
  const target = targetSegments(routePath, localePrefix);
  for (const file of walkPageFiles(appDir)) {
    if (arraysEqual(urlSegments(relative(appDir, dirname(file))), target)) {
      return file;
    }
  }
  return undefined;
}

/**
 * Layout files that wrap a page, from the app root down to the page's own
 * directory. Next.js cascades metadata through these, so SEO checks must read
 * them before concluding a field is missing.
 */
export function collectLayoutFiles(appDir: string, pageFile: string): string[] {
  const relativeDir = relative(appDir, dirname(pageFile));
  const segments = relativeDir && relativeDir !== '.' ? relativeDir.split(sep) : [];

  const dirs = [appDir];
  let current = appDir;
  for (const segment of segments) {
    current = join(current, segment);
    dirs.push(current);
  }

  const layouts: string[] = [];
  for (const dir of dirs) {
    for (const ext of LAYOUT_EXTENSIONS) {
      const candidate = join(dir, `layout${ext}`);
      if (existsSync(candidate)) {
        layouts.push(candidate);
        break;
      }
    }
  }
  return layouts;
}
