import type { RunReport } from '@contentops/core';

export function jsonReport(report: RunReport): string {
  return JSON.stringify(report);
}
