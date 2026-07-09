import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addDismissed,
  defineReleaseLens,
  removeMute,
  runChecks,
} from '../src/index.js';
import type { Check, CheckResult, Confidence } from '../src/index.js';

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

  describe('dismissed.json (single-fp dismiss)', () => {
    let cwd: string;

    beforeEach(() => {
      cwd = mkdtempSync(join(tmpdir(), 'rl-dismiss-'));
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

    function writeDismissed(fingerprint: string, checkId = 'required-locales-exist', surface = 'pricing') {
      writeFileSync(
        join(cwd, '.releaselens', 'dismissed.json'),
        JSON.stringify({
          version: 1,
          entries: [{ fingerprint, checkId, surface, reason: 't', dismissedAt: '2026-01-01' }],
        }),
      );
    }

    it('hides exactly the dismissed fingerprint and leaves others visible', async () => {
      const first = await runChecks(cfg(), { cwd });
      expect(first.results.length).toBeGreaterThan(0);
      const targetFp = first.results[0]!.fingerprint!;
      writeDismissed(targetFp);
      const after = await runChecks(cfg(), { cwd });
      expect(after.results.find((r) => r.fingerprint === targetFp)).toBeUndefined();
      expect(after.results.length).toBe(first.results.length - 1);
    });

    it('skipFilters returns the dismissed finding (raw mode for --update-baseline)', async () => {
      const first = await runChecks(cfg(), { cwd });
      writeDismissed(first.results[0]!.fingerprint!);
      const raw = await runChecks(cfg(), { cwd, skipFilters: true });
      expect(raw.results.length).toBe(first.results.length);
    });

    it('addDismissed persists an entry that the next run hides', async () => {
      const first = await runChecks(cfg(), { cwd });
      const target = first.results.find(
        (r) => r.checkId === 'required-locales-exist',
      )!;
      addDismissed(join(cwd, '.releaselens', 'dismissed.json'), {
        fingerprint: target.fingerprint!,
        checkId: target.checkId,
        surface: 'pricing',
        reason: 'accepted gap',
      });
      const after = await runChecks(cfg(), { cwd });
      expect(after.dismissedCount).toBe(1);
      expect(
        after.results.find((r) => r.fingerprint === target.fingerprint),
      ).toBeUndefined();
    });
  });

  describe('auto-mute (repeated dismissals on the same checkId+surface)', () => {
    let cwd: string;
    let dismissedPath: string;

    beforeEach(() => {
      cwd = mkdtempSync(join(tmpdir(), 'rl-automute-'));
      dismissedPath = join(cwd, '.releaselens', 'dismissed.json');
    });

    afterEach(() => {
      rmSync(cwd, { recursive: true, force: true });
    });

    const cfg = (rules: Record<string, { autoMuteAfter?: number }> = {}) =>
      defineReleaseLens({
        locales: ['en'],
        defaultLocale: 'en',
        appDir: './does-not-exist',
        routes: [
          {
            id: 'pricing',
            path: '/pricing',
            locales: ['en', 'fr', 'de', 'it', 'pt'],
          },
        ],
        rules,
      });

    async function localeFindings(config = cfg()) {
      const report = await runChecks(config, { cwd });
      return report.results.filter(
        (r) => r.checkId === 'required-locales-exist',
      );
    }

    function dismiss(findings: CheckResult[]) {
      for (const f of findings) {
        addDismissed(dismissedPath, {
          fingerprint: f.fingerprint!,
          checkId: f.checkId,
          surface: 'pricing',
          reason: 'test',
        });
      }
    }

    it('suppresses a new fingerprint after 3 dismissals on the same surface (default autoMuteAfter=3)', async () => {
      const findings = await localeFindings();
      expect(findings).toHaveLength(4);
      dismiss(findings.slice(0, 3));

      const after = await runChecks(cfg(), { cwd });
      expect(after.dismissedCount).toBe(3);
      expect(
        after.results.filter((r) => r.checkId === 'required-locales-exist'),
      ).toHaveLength(0);
      expect(after.counts.critical).toBe(0);
      expect(after.passed).toBe(true);
    });

    it('does not mute below the threshold (2 dismissals leave new fingerprints visible)', async () => {
      const findings = await localeFindings();
      dismiss(findings.slice(0, 2));

      const after = await runChecks(cfg(), { cwd });
      const visible = after.results.filter(
        (r) => r.checkId === 'required-locales-exist',
      );
      expect(visible.map((r) => r.locale).sort()).toEqual(['it', 'pt']);
      expect(after.passed).toBe(false);
    });

    it('honors rules[checkId].autoMuteAfter lowering the threshold', async () => {
      const config = cfg({ 'required-locales-exist': { autoMuteAfter: 2 } });
      const findings = await localeFindings(config);
      dismiss(findings.slice(0, 2));

      const after = await runChecks(config, { cwd });
      expect(
        after.results.filter((r) => r.checkId === 'required-locales-exist'),
      ).toHaveLength(0);
      expect(after.passed).toBe(true);
    });

    it('honors rules[checkId].autoMuteAfter raising the threshold', async () => {
      const config = cfg({ 'required-locales-exist': { autoMuteAfter: 5 } });
      const findings = await localeFindings(config);
      dismiss(findings.slice(0, 3));

      const after = await runChecks(config, { cwd });
      const visible = after.results.filter(
        (r) => r.checkId === 'required-locales-exist',
      );
      expect(visible.map((r) => r.locale)).toEqual(['pt']);
      expect(after.passed).toBe(false);
    });

    it('removeMute clears the (checkId, surface) mute and its dismisses so findings resurface', async () => {
      const findings = await localeFindings();
      dismiss(findings.slice(0, 3));
      const muted = await runChecks(cfg(), { cwd });
      expect(
        muted.results.filter((r) => r.checkId === 'required-locales-exist'),
      ).toHaveLength(0);

      removeMute(dismissedPath, 'required-locales-exist', 'pricing');

      const after = await runChecks(cfg(), { cwd });
      expect(after.dismissedCount).toBe(0);
      const visible = after.results.filter(
        (r) => r.checkId === 'required-locales-exist',
      );
      expect(visible.map((r) => r.locale).sort()).toEqual([
        'de',
        'fr',
        'it',
        'pt',
      ]);
      expect(after.passed).toBe(false);
    });
  });

  describe('passed gate (confidence-aware critical blocking)', () => {
    let cwd: string;

    beforeEach(() => {
      cwd = mkdtempSync(join(tmpdir(), 'rl-gate-'));
    });

    afterEach(() => {
      rmSync(cwd, { recursive: true, force: true });
    });

    const criticalCheck = (confidence: Confidence): Check => ({
      id: 'custom-critical',
      description: 'emits a single critical finding',
      defaultSeverity: 'critical',
      defaultConfidence: confidence,
      run: () => [
        {
          checkId: 'custom-critical',
          issueKey: 'boom',
          severity: 'critical',
          confidence,
          message: 'custom critical finding',
          route: 'home',
        },
      ],
    });

    const cfg = () => defineReleaseLens({ appDir: './does-not-exist' });

    it('a low-confidence critical does not block (passed=true)', async () => {
      const report = await runChecks(cfg(), {
        cwd,
        checks: [criticalCheck('low')],
      });
      expect(report.counts.critical).toBe(1);
      expect(report.results[0]?.checkId).toBe('custom-critical');
      expect(report.results[0]?.confidence).toBe('low');
      expect(report.passed).toBe(true);
    });

    it('a high-confidence critical blocks (passed=false)', async () => {
      const report = await runChecks(cfg(), {
        cwd,
        checks: [criticalCheck('high')],
      });
      expect(report.counts.critical).toBe(1);
      expect(report.passed).toBe(false);
    });

    it('a medium-confidence critical blocks (passed=false)', async () => {
      const report = await runChecks(cfg(), {
        cwd,
        checks: [criticalCheck('medium')],
      });
      expect(report.passed).toBe(false);
    });
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
