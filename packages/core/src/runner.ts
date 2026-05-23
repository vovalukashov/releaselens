import type { SiteDoctorConfig } from './config.js';
import { defaultChecks } from './checks/index.js';
import type {
  CheckContext,
  CheckResult,
  RunOptions,
  RunReport,
  Severity,
} from './types.js';

export async function runChecks(
  config: SiteDoctorConfig,
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
    results.push(...out);
  }

  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const r of results) {
    counts[r.severity]++;
  }

  return {
    results,
    counts,
    passed: counts.error === 0,
  };
}
