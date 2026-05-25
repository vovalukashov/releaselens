import type { ContentOpsConfig } from './config.js';

export type Severity = 'error' | 'warning' | 'info';

export interface CheckResult {
  checkId: string;
  severity: Severity;
  message: string;
  route?: string;
  locale?: string;
  data?: Record<string, unknown>;
}

export interface CheckContext {
  config: ContentOpsConfig;
  cwd: string;
}

export interface Check {
  id: string;
  description: string;
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
}
