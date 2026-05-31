import type { ReleaseLensConfig, Severity, Confidence } from './config.js';

export type { Severity, Confidence };

export interface CheckResult {
  checkId: string;
  /**
   * Stable, normalized identifier for the specific issue this finding raises
   * (e.g. `missing-canonical`, `missing-hreflang`, `no-page-file`). Included
   * in the fingerprint so two findings of different kinds on the same surface
   * do not collide in the FP-budget baseline.
   */
  issueKey?: string;
  severity: Severity;
  confidence: Confidence;
  message: string;
  route?: string;
  form?: string;
  event?: string;
  locale?: string;
  data?: Record<string, unknown>;
  fingerprint?: string;
  explanation?: string;
  explanationError?: string;
}

export interface CheckContext {
  config: ReleaseLensConfig;
  cwd: string;
}

export interface Check {
  id: string;
  description: string;
  defaultSeverity: Severity;
  defaultConfidence: Confidence;
  run(ctx: CheckContext): Promise<CheckResult[]> | CheckResult[];
}

export interface RunOptions {
  checks?: Check[];
  cwd?: string;
}

export interface RunReport {
  results: CheckResult[];
  counts: Record<Severity, number>;
  passed: boolean;
  baselineLoaded: boolean;
  dismissedCount: number;
}
