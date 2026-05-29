import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSeoMetadata } from '../seo/parse-metadata.js';
import { findPageFile } from './find-page-file.js';
import type { Check, CheckResult } from '../types.js';

const CHECK_ID = 'locales-static';

export const localesStaticCheck: Check = {
  id: CHECK_ID,
  description:
    'For each route with non-default locales declared, verify a localized page file exists and its metadata mirrors the default.',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  run({ config, cwd }) {
    const results: CheckResult[] = [];
    const appDir = resolve(cwd, config.appDir);
    if (!existsSync(appDir)) return results;

    for (const route of config.routes) {
      const locales = route.locales;
      if (!locales || locales.length === 0) continue;

      const defaultPage = findPageFile(appDir, route.path);
      const defaultMeta = defaultPage
        ? parseSeoMetadata(readFileSync(defaultPage, 'utf8'), defaultPage)
        : null;

      for (const locale of locales) {
        if (locale === config.defaultLocale) continue;

        const localizedPage = findPageFile(appDir, route.path, locale);
        if (!localizedPage) {
          results.push({
            checkId: CHECK_ID,
            severity: 'critical',
            confidence: 'high',
            message: `Route "${route.id}" declares locale "${locale}" but no localized page file found at ${config.appDir}/${locale}${route.path === '/' ? '' : route.path}/page.{tsx,ts,jsx,js}.`,
            route: route.id,
            locale,
          });
          continue;
        }

        if (!defaultMeta) continue;

        const localizedMeta = parseSeoMetadata(
          readFileSync(localizedPage, 'utf8'),
          localizedPage,
        );

        if (defaultMeta.hasMetadata && !localizedMeta.hasMetadata && !localizedMeta.hasGenerateMetadata) {
          results.push({
            checkId: CHECK_ID,
            severity: 'warning',
            confidence: 'high',
            message: `Route "${route.id}" locale "${locale}": default has metadata but localized variant has no \`metadata\` or \`generateMetadata\` export.`,
            route: route.id,
            locale,
          });
          continue;
        }

        if (defaultMeta.title && !localizedMeta.title) {
          results.push({
            checkId: CHECK_ID,
            severity: 'warning',
            confidence: 'high',
            message: `Route "${route.id}" locale "${locale}": missing \`metadata.title\` (default locale has one).`,
            route: route.id,
            locale,
          });
        }
        if (defaultMeta.canonical && !localizedMeta.canonical) {
          results.push({
            checkId: CHECK_ID,
            severity: 'critical',
            confidence: 'high',
            message: `Route "${route.id}" locale "${locale}": missing \`metadata.alternates.canonical\` (default locale has one).`,
            route: route.id,
            locale,
          });
        }
        if (
          defaultMeta.canonical &&
          localizedMeta.canonical &&
          defaultMeta.canonical === localizedMeta.canonical
        ) {
          results.push({
            checkId: CHECK_ID,
            severity: 'critical',
            confidence: 'high',
            message: `Route "${route.id}" locale "${locale}": canonical points to default-locale URL (\`${localizedMeta.canonical}\`) — should be locale-specific.`,
            route: route.id,
            locale,
          });
        }
      }
    }

    return results;
  },
};
