import type { RunReport } from '@site-doctor/core';

export function jsonReport(report: RunReport): string {
  return JSON.stringify(report);
}
