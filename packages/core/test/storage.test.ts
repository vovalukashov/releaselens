import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeFingerprint } from '../src/storage/fingerprint.js';
import {
  BASELINE_SCHEMA_VERSION,
  readBaseline,
  writeBaseline,
} from '../src/storage/baseline.js';
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
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rl-baseline-'));
    file = join(dir, 'baseline.json');
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
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
    expect(stderrSpy).toHaveBeenCalled();
    const warning = (stderrSpy.mock.calls[0]?.[0] ?? '') as string;
    expect(warning).toContain('--update-baseline');
  });

  it('returns null when the file does not exist', () => {
    expect(readBaseline(join(dir, 'missing.json'))).toBeNull();
  });
});
