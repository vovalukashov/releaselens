import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mergeSeoMetadata, parseSeoMetadata } from '../seo/parse-metadata.js';
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

      const pageMeta = parseSeoMetadata(readFileSync(pageFile, 'utf8'), pageFile);

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
        parseSeoMetadata(readFileSync(file, 'utf8'), file),
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
        meta.hasMetadataSpread || meta.hasMetadataHelperWrap ? 'low' : 'high';
      const spreadNote = meta.hasMetadataSpread
        ? ' (a spread is present, may be set dynamically)'
        : meta.hasMetadataHelperWrap
          ? ' (wrapped via a helper call — defaults may be applied outside the analysed file)'
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
