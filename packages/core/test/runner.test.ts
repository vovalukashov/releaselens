import { describe, expect, it } from 'vitest';
import { defineReleaseLens, runChecks } from '../src/index.js';

describe('runChecks', () => {
  it('passes on a clean config', async () => {
    const cfg = defineReleaseLens({
      locales: ['en'],
      defaultLocale: 'en',
      routes: [{ id: 'home', path: '/', businessImpact: 'high' }],
    });
    const report = await runChecks(cfg);
    expect(report.passed).toBe(true);
    expect(report.counts.critical).toBe(0);
  });

  it('emits info findings for SEO placeholder check per route', async () => {
    const cfg = defineReleaseLens({
      routes: [
        { id: 'pricing', path: '/pricing' },
        { id: 'contact', path: '/contact' },
      ],
    });
    const report = await runChecks(cfg);
    const seo = report.results.filter(
      (r) => r.checkId === 'seo-metadata-declared',
    );
    expect(seo).toHaveLength(2);
    expect(seo.every((r) => r.severity === 'info')).toBe(true);
  });

  it('fails with critical when a route requires an unknown locale', async () => {
    const cfg = defineReleaseLens({
      locales: ['en'],
      defaultLocale: 'en',
      routes: [{ id: 'pricing', path: '/pricing', locales: ['en', 'fr'] }],
    });
    const report = await runChecks(cfg);
    expect(report.passed).toBe(false);
    expect(report.counts.critical).toBeGreaterThanOrEqual(1);
    expect(
      report.results.find(
        (r) => r.checkId === 'required-locales-exist' && r.locale === 'fr',
      ),
    ).toBeDefined();
  });

  it('fails when a form references a missing route', async () => {
    const cfg = defineReleaseLens({
      routes: [{ id: 'pricing', path: '/pricing' }],
      forms: [
        {
          id: 'orphan-form',
          onRoute: 'nonexistent',
          selector: 'form',
          successState: { type: 'route', value: '/thanks' },
        },
      ],
    });
    const report = await runChecks(cfg);
    expect(report.passed).toBe(false);
    expect(
      report.results.find(
        (r) =>
          r.checkId === 'form-references-route' && r.form === 'orphan-form',
      ),
    ).toBeDefined();
  });

  it('fails when an event targets a missing form', async () => {
    const cfg = defineReleaseLens({
      events: [{ name: 'evt_x', onForm: 'nonexistent', consent: 'analytics' }],
    });
    const report = await runChecks(cfg);
    expect(report.passed).toBe(false);
    expect(
      report.results.find(
        (r) => r.checkId === 'event-target-valid' && r.event === 'evt_x',
      ),
    ).toBeDefined();
  });

  it('applies rule overrides for severity', async () => {
    const cfg = defineReleaseLens({
      routes: [{ id: 'home', path: '/' }],
      rules: { 'seo-metadata-declared': { severity: 'warning' } },
    });
    const report = await runChecks(cfg);
    const seo = report.results.find(
      (r) => r.checkId === 'seo-metadata-declared',
    );
    expect(seo?.severity).toBe('warning');
  });
});
