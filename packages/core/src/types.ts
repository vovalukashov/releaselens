import type { ReleaseLensConfig, Severity, Confidence } from './config.js';

export type { Severity, Confidence };

export interface CheckResult {
  checkId: string;
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
