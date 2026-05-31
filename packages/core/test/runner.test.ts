import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineReleaseLens, runChecks } from '../src/index.js';

describe('runChecks', () => {
  it('passes on a clean config (no appDir = SEO check skipped)', async () => {
    const cfg = defineReleaseLens({
      locales: ['en'],
      defaultLocale: 'en',
      appDir: './does-not-exist',
      routes: [{ id: 'home', path: '/', businessImpact: 'high' }],
    });
    const report = await runChecks(cfg);
    expect(report.passed).toBe(true);
    expect(report.counts.critical).toBe(0);
  });

  it('emits an info finding when appDir is missing', async () => {
    const cfg = defineReleaseLens({
      appDir: './does-not-exist',
      routes: [{ id: 'pricing', path: '/pricing' }],
    });
    const report = await runChecks(cfg);
    const seo = report.results.filter((r) => r.checkId === 'seo-static');
    expect(seo).toHaveLength(1);
    expect(seo[0]?.severity).toBe('info');
  });

  it('fails with critical when a route requires an unknown locale', async () => {
    const cfg = defineReleaseLens({
      locales: ['en'],
      defaultLocale: 'en',
      appDir: './does-not-exist',
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
      appDir: './does-not-exist',
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
      appDir: './does-not-exist',
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

  describe('skipFilters', () => {
    let cwd: string;

    beforeEach(() => {
      cwd = mkdtempSync(join(tmpdir(), 'rl-runner-'));
      mkdirSync(join(cwd, '.releaselens'), { recursive: true });
    });

    afterEach(() => {
      rmSync(cwd, { recursive: true, force: true });
    });

    const cfg = () =>
      defineReleaseLens({
        locales: ['en'],
        defaultLocale: 'en',
        appDir: './does-not-exist',
        routes: [{ id: 'pricing', path: '/pricing', locales: ['en', 'fr'] }],
      });

    it('filters findings already in the baseline by default', async () => {
      const first = await runChecks(cfg(), { cwd });
      const fingerprints = first.results
        .map((r) => r.fingerprint)
        .filter((fp): fp is string => Boolean(fp));
      expect(fingerprints.length).toBeGreaterThan(0);

      writeFileSync(
        join(cwd, '.releaselens', 'baseline.json'),
        JSON.stringify({
          version: 2,
          createdAt: new Date().toISOString(),
          fingerprints,
        }),
      );

      const second = await runChecks(cfg(), { cwd });
      expect(second.results).toHaveLength(0);
    });

    it('returns the raw findings when skipFilters is true so --update-baseline can re-snapshot', async () => {
      const first = await runChecks(cfg(), { cwd });
      const fingerprints = first.results
        .map((r) => r.fingerprint)
        .filter((fp): fp is string => Boolean(fp));

      writeFileSync(
        join(cwd, '.releaselens', 'baseline.json'),
        JSON.stringify({
          version: 2,
          createdAt: new Date().toISOString(),
          fingerprints,
        }),
      );

      const snap = await runChecks(cfg(), { cwd, skipFilters: true });
      expect(snap.results.length).toBe(first.results.length);
      const snapFps = snap.results.map((r) => r.fingerprint);
      for (const fp of fingerprints) expect(snapFps).toContain(fp);
    });
  });

  it('applies rule overrides for severity', async () => {
    const cfg = defineReleaseLens({
      appDir: './does-not-exist',
      routes: [{ id: 'home', path: '/' }],
      rules: { 'seo-static': { severity: 'warning' } },
    });
    const report = await runChecks(cfg);
    const seo = report.results.find((r) => r.checkId === 'seo-static');
    expect(seo?.severity).toBe('warning');
  });
});
