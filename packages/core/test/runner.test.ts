import { describe, expect, it } from 'vitest';
import { defineContentOps, runChecks } from '../src/index.js';

describe('runChecks', () => {
  it('passes on a clean config', async () => {
    const cfg = defineContentOps({
      locales: ['en'],
      defaultLocale: 'en',
      routes: [
        {
          id: 'home',
          path: '/',
          requiredMetadata: ['title', 'description'],
        },
      ],
    });
    const report = await runChecks(cfg);
    expect(report.passed).toBe(true);
    expect(report.counts.error).toBe(0);
    expect(report.counts.info).toBeGreaterThanOrEqual(1);
  });

  it('warns when a route is bound to a CMS collection but has no slug', async () => {
    const cfg = defineContentOps({
      cms: 'payload',
      locales: ['en'],
      defaultLocale: 'en',
      routes: [
        {
          id: 'pricing',
          path: '/pricing',
          cms: { collection: 'pages' },
          requiredMetadata: ['title'],
        },
      ],
    });
    const report = await runChecks(cfg);
    expect(report.counts.warning).toBeGreaterThanOrEqual(1);
    expect(report.passed).toBe(true);
    expect(
      report.results.some((r) => r.checkId === 'route-has-cms-entry'),
    ).toBe(true);
  });

  it('errors when a route requires a locale not present in the top-level locales list', async () => {
    const cfg = defineContentOps({
      locales: ['en'],
      defaultLocale: 'en',
      routes: [
        {
          id: 'pricing',
          path: '/pricing',
          requiredLocales: ['en', 'fr'],
          requiredMetadata: ['title'],
        },
      ],
    });
    const report = await runChecks(cfg);
    expect(report.counts.error).toBeGreaterThanOrEqual(1);
    expect(report.passed).toBe(false);
    expect(
      report.results.find(
        (r) => r.checkId === 'required-locales-exist' && r.locale === 'fr',
      ),
    ).toBeDefined();
  });

  it('warns when a route declares no required metadata', async () => {
    const cfg = defineContentOps({
      locales: ['en'],
      defaultLocale: 'en',
      routes: [{ id: 'naked', path: '/naked' }],
    });
    const report = await runChecks(cfg);
    expect(
      report.results.some(
        (r) =>
          r.checkId === 'required-metadata-exists' && r.severity === 'warning',
      ),
    ).toBe(true);
  });
});
