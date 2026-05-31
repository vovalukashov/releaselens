import { createHash } from 'node:crypto';
import type { CheckResult } from '../types.js';

export function computeFingerprint(result: CheckResult): string {
  const parts = [
    result.checkId,
    result.issueKey ?? '',
    result.route ?? '',
    result.form ?? '',
    result.event ?? '',
    result.locale ?? '',
  ];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12);
}

export function getSurface(result: CheckResult): string {
  return result.route ?? result.form ?? result.event ?? '(global)';
}
