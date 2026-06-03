import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSeoMetadata } from '../seo/parse-metadata.js';
import { findPageFile } from './find-page-file.js';
import type { Route } from '../config.js';
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

    const localeParam = config.localeParam;

    for (const route of config.routes) {
      const locales = route.locales;
      if (!locales || locales.length === 0) continue;

      if (routeHasLocaleSegment(route.path, localeParam)) {
        results.push(
          ...checkDynamicSegmentRoute(appDir, route, locales, localeParam),
        );
        continue;
      }

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
            issueKey: 'locale-page-missing',
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
            issueKey: 'localized-metadata-missing',
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
            issueKey: 'localized-title-missing',
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
            issueKey: 'localized-canonical-missing',
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
            issueKey: 'localized-canonical-collision',
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

function routeHasLocaleSegment(routePath: string, localeParam: string): boolean {
  const token = `[${localeParam}]`;
  return routePath.split('/').includes(token);
}

/**
 * next-intl-style routing: a single physical page (e.g. `app/[locale]/[slug]`)
 * serves every locale through the dynamic segment. There is no per-locale file
 * to look up, so instead we verify the page produces *per-locale* metadata.
 * A static `metadata` export cannot read the locale param, so its title,
 * description and canonical are identical for every locale — a localization bug.
 */
function checkDynamicSegmentRoute(
  appDir: string,
  route: Route,
  locales: string[],
  localeParam: string,
): CheckResult[] {
  const results: CheckResult[] = [];

  const page = findPageFile(appDir, route.path);
  if (!page) {
    results.push({
      checkId: CHECK_ID,
      issueKey: 'locale-page-missing',
      severity: 'critical',
      confidence: 'high',
      message: `Route "${route.id}" uses a dynamic "[${localeParam}]" locale segment but no page file resolves for ${route.path}.`,
      route: route.id,
    });
    return results;
  }

  const meta = parseSeoMetadata(readFileSync(page, 'utf8'), page);

  if (meta.hasMetadata && !meta.hasGenerateMetadata) {
    const dynamicish = meta.hasDynamicSpread || meta.hasMetadataHelperWrap;
    results.push({
      checkId: CHECK_ID,
      issueKey: 'static-metadata-on-localized-route',
      severity: 'warning',
      confidence: dynamicish ? 'low' : 'high',
      message: `Route "${route.id}" serves ${locales.length} locales via the "[${localeParam}]" segment but exports static \`metadata\` — title, description and canonical will be identical for every locale and no hreflang is emitted. Use \`generateMetadata({ params })\` to vary metadata per locale.`,
      route: route.id,
    });
  }

  return results;
}
