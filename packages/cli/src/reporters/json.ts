import type { RunReport } from '@releaselens/core';

export function jsonReport(report: RunReport): string {
  return JSON.stringify(report);
}
