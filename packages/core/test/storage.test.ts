import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeFingerprint } from '../src/storage/fingerprint.js';
import {
  BASELINE_SCHEMA_VERSION,
  readBaseline,
  writeBaseline,
} from '../src/storage/baseline.js';
import {
  addDismissed,
  readDismissed,
  removeMute,
} from '../src/storage/dismissed.js';
import type { CheckResult } from '../src/types.js';

function makeResult(overrides: Partial<CheckResult>): CheckResult {
  return {
    checkId: 'seo-static',
    severity: 'critical',
    confidence: 'high',
    message: 'x',
    ...overrides,
  };
}

describe('computeFingerprint', () => {
  it('produces distinct fingerprints when issueKey differs on the same surface', () => {
    const a = makeResult({ route: 'home', issueKey: 'missing-canonical' });
    const b = makeResult({ route: 'home', issueKey: 'missing-hreflang' });
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b));
  });

  it('produces distinct fingerprints when route differs but issueKey matches', () => {
    const a = makeResult({ route: 'home', issueKey: 'missing-canonical' });
    const b = makeResult({ route: 'pricing', issueKey: 'missing-canonical' });
    expect(computeFingerprint(a)).not.toBe(computeFingerprint(b));
  });

  it('is stable for the same (checkId, issueKey, route, form, event, locale)', () => {
    const a = makeResult({ route: 'home', issueKey: 'missing-canonical', locale: 'en' });
    const b = makeResult({ route: 'home', issueKey: 'missing-canonical', locale: 'en' });
    expect(computeFingerprint(a)).toBe(computeFingerprint(b));
  });

  it('ignores severity, confidence, and message text', () => {
    const a = makeResult({
      route: 'home',
      issueKey: 'missing-canonical',
      severity: 'critical',
      message: 'A',
    });
    const b = makeResult({
      route: 'home',
      issueKey: 'missing-canonical',
      severity: 'warning',
      confidence: 'low',
      message: 'B',
    });
    expect(computeFingerprint(a)).toBe(computeFingerprint(b));
  });
});

describe('baseline storage', () => {
  let dir: string;
  let file: string;
  const stderrCalls: string[] = [];
  const origStderrWrite = process.stderr.write.bind(process.stderr);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rl-baseline-'));
    file = join(dir, 'baseline.json');
    stderrCalls.length = 0;
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      stderrCalls.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = origStderrWrite;
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes the current schema version and dedupes fingerprints', () => {
    writeBaseline(file, ['b', 'a', 'b', 'c']);
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    expect(raw.version).toBe(BASELINE_SCHEMA_VERSION);
    expect(raw.fingerprints).toEqual(['a', 'b', 'c']);
  });

  it('reads back what it wrote', () => {
    writeBaseline(file, ['fp1', 'fp2']);
    const baseline = readBaseline(file);
    expect(baseline?.version).toBe(BASELINE_SCHEMA_VERSION);
    expect(baseline?.fingerprints).toEqual(['fp1', 'fp2']);
  });

  it('treats a legacy v1 baseline as missing and warns', () => {
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        fingerprints: ['legacy'],
      }),
      'utf8',
    );
    const baseline = readBaseline(file);
    expect(baseline).toBeNull();
    expect(stderrCalls.length).toBeGreaterThan(0);
    expect(stderrCalls.join('\n')).toContain('--update-baseline');
  });

  it('returns null when the file does not exist', () => {
    expect(readBaseline(join(dir, 'missing.json'))).toBeNull();
  });
});

describe('dismissed storage', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rl-dismissed-'));
    file = join(dir, 'dismissed.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const entry = (
    fingerprint: string,
    checkId = 'seo-static',
    surface = 'home',
  ) => ({
    fingerprint,
    checkId,
    surface,
    reason: 'accepted tradeoff',
  });

  describe('addDismissed', () => {
    it('persists fingerprint, checkId, surface, reason, and a dismissedAt timestamp', () => {
      const next = addDismissed(file, entry('fp-1'));
      expect(next.entries).toHaveLength(1);

      const raw = JSON.parse(readFileSync(file, 'utf8'));
      expect(raw.version).toBe(1);
      expect(raw.entries[0]).toMatchObject({
        fingerprint: 'fp-1',
        checkId: 'seo-static',
        surface: 'home',
        reason: 'accepted tradeoff',
      });
      expect(Number.isNaN(Date.parse(raw.entries[0].dismissedAt))).toBe(false);
    });

    it('is idempotent per fingerprint and keeps the original entry', () => {
      addDismissed(file, entry('fp-1'));
      const again = addDismissed(file, {
        ...entry('fp-1'),
        reason: 'second attempt',
      });
      expect(again.entries).toHaveLength(1);
      expect(again.entries[0]?.reason).toBe('accepted tradeoff');
      expect(readDismissed(file).entries).toHaveLength(1);
    });

    it('appends distinct fingerprints in dismissal order', () => {
      addDismissed(file, entry('fp-1'));
      const next = addDismissed(file, entry('fp-2'));
      expect(next.entries.map((e) => e.fingerprint)).toEqual(['fp-1', 'fp-2']);
      expect(readDismissed(file).entries.map((e) => e.fingerprint)).toEqual([
        'fp-1',
        'fp-2',
      ]);
    });
  });

  describe('removeMute', () => {
    it('removes every entry for (checkId, surface) including single-fingerprint dismisses', () => {
      addDismissed(file, entry('fp-1'));
      addDismissed(file, entry('fp-2'));
      addDismissed(file, entry('fp-3'));
      addDismissed(file, entry('fp-4', 'seo-static', 'pricing'));
      addDismissed(file, entry('fp-5', 'locales-static', 'home'));

      const next = removeMute(file, 'seo-static', 'home');

      expect(next.entries.map((e) => e.fingerprint)).toEqual(['fp-4', 'fp-5']);
      expect(readDismissed(file).entries.map((e) => e.fingerprint)).toEqual([
        'fp-4',
        'fp-5',
      ]);
    });

    it('leaves other (checkId, surface) pairs untouched when nothing matches', () => {
      addDismissed(file, entry('fp-1'));
      const next = removeMute(file, 'seo-static', 'pricing');
      expect(next.entries.map((e) => e.fingerprint)).toEqual(['fp-1']);
      expect(readDismissed(file).entries).toHaveLength(1);
    });
  });
});
