import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseSeoMetadata } from '../seo/parse-metadata.js';
import type { Check, CheckResult } from '../types.js';

const PAGE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
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
          severity: 'critical',
          confidence: 'high',
          message: `Route "${route.id}": no page file found under ${appDir}${route.path === '/' ? '' : route.path}/page.{tsx,ts,jsx,js}.`,
          route: route.id,
        });
        continue;
      }

      const source = readFileSync(pageFile, 'utf8');
      const meta = parseSeoMetadata(source, pageFile);

      if (!meta.hasMetadata && !meta.hasGenerateMetadata) {
        results.push({
          checkId: CHECK_ID,
          severity: 'warning',
          confidence: 'high',
          message: `Route "${route.id}": no \`metadata\` or \`generateMetadata\` export found in ${relativePath(cwd, pageFile)}.`,
          route: route.id,
        });
        continue;
      }

      if (meta.hasGenerateMetadata && !meta.hasMetadata) {
        results.push({
          checkId: CHECK_ID,
          severity: 'info',
          confidence: 'low',
          message: `Route "${route.id}": uses dynamic \`generateMetadata\` — static SEO verification skipped.`,
          route: route.id,
        });
        continue;
      }

      if (!meta.title) {
        results.push({
          checkId: CHECK_ID,
          severity: 'critical',
          confidence: 'high',
          message: `Route "${route.id}": missing static \`metadata.title\`.`,
          route: route.id,
        });
      }
      if (!meta.description) {
        results.push({
          checkId: CHECK_ID,
          severity: 'warning',
          confidence: 'high',
          message: `Route "${route.id}": missing static \`metadata.description\`.`,
          route: route.id,
        });
      }
      if (route.businessImpact === 'high' && !meta.canonical) {
        results.push({
          checkId: CHECK_ID,
          severity: 'critical',
          confidence: 'high',
          message: `Route "${route.id}" (businessImpact=high): missing \`metadata.alternates.canonical\`.`,
          route: route.id,
        });
      }
      if (
        route.locales &&
        route.locales.length > 1 &&
        (!meta.hreflang || Object.keys(meta.hreflang).length === 0)
      ) {
        results.push({
          checkId: CHECK_ID,
          severity: 'warning',
          confidence: 'high',
          message: `Route "${route.id}" declares ${route.locales.length} locales but \`metadata.alternates.languages\` (hreflang) is not set.`,
          route: route.id,
        });
      }
      if (route.businessImpact === 'high' && meta.robotsIndex === false) {
        results.push({
          checkId: CHECK_ID,
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

function findPageFile(appDir: string, routePath: string): string | undefined {
  const subPath = routePath === '/' ? '' : routePath;
  for (const ext of PAGE_EXTENSIONS) {
    const candidate = join(appDir, subPath, `page${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function relativePath(cwd: string, file: string): string {
  return file.startsWith(cwd) ? file.slice(cwd.length + 1) : file;
}
