import type { ReleaseLensConfig } from './config.js';
import { defaultChecks } from './checks/index.js';
import type {
  CheckContext,
  CheckResult,
  RunOptions,
  RunReport,
  Severity,
} from './types.js';

export async function runChecks(
  config: ReleaseLensConfig,
  opts: RunOptions = {},
): Promise<RunReport> {
  const checks = opts.checks ?? defaultChecks;
  const ctx: CheckContext = {
    config,
    cwd: opts.cwd ?? process.cwd(),
  };

  const results: CheckResult[] = [];
  for (const check of checks) {
    const out = await check.run(ctx);
    results.push(...applyRuleOverrides(out, config, check.id));
  }

  const counts: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  for (const r of results) {
    counts[r.severity]++;
  }

  return {
    results,
    counts,
    passed: counts.critical === 0,
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
