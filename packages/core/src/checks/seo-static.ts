import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import {
  mergeSeoMetadata,
  parseSeoMetadata,
  type SeoMetadata,
} from '../seo/parse-metadata.js';
import { collectLayoutFiles, findPageFile } from './find-page-file.js';
import type { Check, CheckResult } from '../types.js';

const CHECK_ID = 'seo-static';

export const seoStaticCheck: Check = {
  id: CHECK_ID,
  description:
    'Statically verify each route\'s Next.js metadata declarations (title, description, canonical, hreflang, noindex).',
  defaultSeverity: 'warning',
  defaultConfidence: 'high',
  run({ config, cwd }) {
    const results: CheckResult[] = [];
    const appDir = resolve(cwd, config.appDir);

    if (!existsSync(appDir)) {
      results.push({
        checkId: CHECK_ID,
        issueKey: 'app-dir-not-found',
        severity: 'info',
        confidence: 'low',
        message: `appDir "${config.appDir}" not found at ${appDir} — SEO static check skipped. Configure \`appDir\` in your releaselens.config.ts to enable.`,
      });
      return results;
    }

    for (const route of config.routes) {
      const pageFile = findPageFile(appDir, route.path);
      if (!pageFile) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'no-page-file',
          severity: 'critical',
          confidence: 'high',
          message: `Route "${route.id}": no page file found under ${appDir}${route.path === '/' ? '' : route.path}/page.{tsx,ts,jsx,js}.`,
          route: route.id,
        });
        continue;
      }

      const pageMeta = parseFileMetadata(pageFile);

      if (pageMeta.hasGenerateMetadata && !pageMeta.hasMetadata) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'dynamic-generate-metadata',
          severity: 'info',
          confidence: 'low',
          message: `Route "${route.id}": uses dynamic \`generateMetadata\` — static SEO verification skipped.`,
          route: route.id,
        });
        continue;
      }

      const layoutMetas = collectLayoutFiles(appDir, pageFile).map((file) =>
        parseFileMetadata(file),
      );
      const meta = mergeSeoMetadata([...layoutMetas, pageMeta]);

      if (!meta.hasMetadata) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'no-metadata',
          severity: 'warning',
          confidence: 'high',
          message: `Route "${route.id}": no \`metadata\` or \`generateMetadata\` export found in ${relativePath(cwd, pageFile)} or its layouts.`,
          route: route.id,
        });
        continue;
      }

      const presenceConfidence =
        meta.hasMetadataSpread ||
        meta.hasMetadataHelperWrap ||
        meta.hasGenerateMetadata
          ? 'low'
          : 'high';
      const spreadNote = meta.hasMetadataSpread
        ? ' (a spread is present, may be set dynamically)'
        : meta.hasMetadataHelperWrap
          ? ' (wrapped via a helper call — defaults may be applied outside the analysed file)'
          : meta.hasGenerateMetadata
            ? ' (computed in `generateMetadata` — may be set dynamically per request)'
            : '';

      if (!meta.hasTitle) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'missing-title',
          severity: 'critical',
          confidence: presenceConfidence,
          message: `Route "${route.id}": missing \`metadata.title\` (not set on the page or any layout)${spreadNote}.`,
          route: route.id,
        });
      }
      if (!meta.hasDescription) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'missing-description',
          severity: 'warning',
          confidence: presenceConfidence,
          message: `Route "${route.id}": missing \`metadata.description\` (not set on the page or any layout)${spreadNote}.`,
          route: route.id,
        });
      }
      if (route.businessImpact === 'high' && !meta.hasCanonical) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'missing-canonical',
          severity: 'critical',
          confidence: presenceConfidence,
          message: `Route "${route.id}" (businessImpact=high): missing \`metadata.alternates.canonical\`${spreadNote}.`,
          route: route.id,
        });
      }
      if (route.locales && route.locales.length > 1 && !meta.hasHreflang) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'missing-hreflang',
          severity: 'warning',
          confidence: presenceConfidence,
          message: `Route "${route.id}" declares ${route.locales.length} locales but \`metadata.alternates.languages\` (hreflang) is not set${spreadNote}.`,
          route: route.id,
        });
      }
      if (route.businessImpact === 'high' && meta.robotsIndex === false) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'noindex-on-business-critical',
          severity: 'critical',
          confidence: 'high',
          message: `Route "${route.id}" (businessImpact=high): \`robots.index\` is false (noindex) — probably accidental.`,
          route: route.id,
        });
      }
    }

    return results;
  },
};

function relativePath(cwd: string, file: string): string {
  return file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;
}

/**
 * Parse a file's metadata, following a `export { default as metadata } from '...'`
 * re-export into the module that actually holds the object. The target's real
 * fields are merged in, so a page inheriting layout metadata defined in a
 * separate contents module is not falsely flagged as missing title/description.
 */
function parseFileMetadata(
  file: string,
  seen: Set<string> = new Set(),
): SeoMetadata {
  const meta = parseSeoMetadata(readFileSync(file, 'utf8'), file);
  if (!meta.metadataReexport || seen.has(file)) return meta;

  seen.add(file);
  const target = resolveModuleFile(file, meta.metadataReexport);
  if (!target) return meta;

  const targetMeta = parseFileMetadata(target, seen);
  return mergeSeoMetadata([targetMeta, meta]);
}

const MODULE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function resolveWithExtensions(base: string): string | undefined {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  for (const ext of MODULE_EXTENSIONS) {
    const candidate = resolve(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function resolveModuleFile(fromFile: string, spec: string): string | undefined {
  if (spec.startsWith('.')) {
    return resolveWithExtensions(resolve(dirname(fromFile), spec));
  }
  const aliased = resolveTsAlias(spec, dirname(fromFile));
  return aliased ? resolveWithExtensions(aliased) : undefined;
}

const tsPathsCache = new Map<
  string,
  { basePath: string; paths: Record<string, string[]> } | null
>();

function loadTsPaths(
  fromDir: string,
): { basePath: string; paths: Record<string, string[]> } | null {
  const cached = tsPathsCache.get(fromDir);
  if (cached !== undefined) return cached;

  const tsconfigPath = ts.findConfigFile(
    fromDir,
    ts.sys.fileExists,
    'tsconfig.json',
  );
  if (!tsconfigPath) {
    tsPathsCache.set(fromDir, null);
    return null;
  }
  const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const compilerOptions = read.config?.compilerOptions ?? {};
  const paths = compilerOptions.paths as Record<string, string[]> | undefined;
  if (!paths) {
    tsPathsCache.set(fromDir, null);
    return null;
  }
  const tsconfigDir = dirname(tsconfigPath);
  const basePath = compilerOptions.baseUrl
    ? resolve(tsconfigDir, compilerOptions.baseUrl)
    : tsconfigDir;
  const entry = { basePath, paths };
  tsPathsCache.set(fromDir, entry);
  return entry;
}

function resolveTsAlias(spec: string, fromDir: string): string | undefined {
  const cfg = loadTsPaths(fromDir);
  if (!cfg) return undefined;

  for (const [pattern, targets] of Object.entries(cfg.paths)) {
    const target = targets[0];
    if (!target) continue;
    const star = pattern.indexOf('*');
    if (star === -1) {
      if (pattern === spec) return resolve(cfg.basePath, target);
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (spec.startsWith(prefix) && spec.endsWith(suffix)) {
      const wildcard = spec.slice(prefix.length, spec.length - suffix.length);
      return resolve(cfg.basePath, target.replace('*', wildcard));
    }
  }
  return undefined;
}
