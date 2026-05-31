import { resolve } from 'node:path';
import type { ReleaseLensConfig } from './config.js';
import { defaultChecks } from './checks/index.js';
import { readBaseline } from './storage/baseline.js';
import { isAutoMuted, readDismissed } from './storage/dismissed.js';
import { computeFingerprint, getSurface } from './storage/fingerprint.js';
import type {
  CheckContext,
  CheckResult,
  RunOptions,
  RunReport,
  Severity,
} from './types.js';

const DEFAULT_BASELINE_PATH = '.releaselens/baseline.json';
const DEFAULT_DISMISSED_PATH = '.releaselens/dismissed.json';
const DEFAULT_AUTO_MUTE_AFTER = 3;

export async function runChecks(
  config: ReleaseLensConfig,
  opts: RunOptions = {},
): Promise<RunReport> {
  const checks = opts.checks ?? defaultChecks;
  const cwd = opts.cwd ?? process.cwd();
  const ctx: CheckContext = { config, cwd };

  const baseline = readBaseline(resolve(cwd, DEFAULT_BASELINE_PATH));
  const dismissed = readDismissed(resolve(cwd, DEFAULT_DISMISSED_PATH));
  const baselineSet = new Set(baseline?.fingerprints ?? []);

  const raw: CheckResult[] = [];
  for (const check of checks) {
    const out = await check.run(ctx);
    raw.push(...applyRuleOverrides(out, config, check.id));
  }

  const withFingerprints = raw.map((r) => ({
    ...r,
    fingerprint: computeFingerprint(r),
  }));

  const visible = opts.skipFilters
    ? withFingerprints
    : withFingerprints.filter((r) => {
        if (baselineSet.has(r.fingerprint)) return false;
        const surface = getSurface(r);
        const threshold =
          config.rules[r.checkId]?.autoMuteAfter ?? DEFAULT_AUTO_MUTE_AFTER;
        if (isAutoMuted(dismissed, r.checkId, surface, threshold)) {
          return false;
        }
        return true;
      });

  const counts: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const r of visible) counts[r.severity]++;

  const blockingCritical = visible.some(
    (r) => r.severity === 'critical' && r.confidence !== 'low',
  );

  return {
    results: visible,
    counts,
    passed: !blockingCritical,
    baselineLoaded: Boolean(baseline),
    dismissedCount: dismissed.entries.length,
  };
}

function applyRuleOverrides(
  results: CheckResult[],
  config: ReleaseLensConfig,
  checkId: string,
): CheckResult[] {
  const rule = config.rules[checkId];
  if (!rule) return results;
  return results.map((r) => ({
    ...r,
    severity: rule.severity ?? r.severity,
    confidence: rule.confidence ?? r.confidence,
  }));
}
