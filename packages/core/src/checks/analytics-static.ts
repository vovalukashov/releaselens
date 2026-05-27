import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTrackingCalls } from '../analytics/parse-tracking-calls.js';
import type { Check, CheckResult } from '../types.js';

const SCAN_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);
const SCAN_SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist']);
const CHECK_ID = 'analytics-static';

export const analyticsStaticCheck: Check = {
  id: CHECK_ID,
  description:
    'Verify declared analytics events appear in tracking call sites (track / posthog.capture / analytics.track / gtag).',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  run({ config, cwd }) {
    const results: CheckResult[] = [];
    if (config.events.length === 0) return results;

    const appDir = resolve(cwd, config.appDir);
    if (!existsSync(appDir)) return results;

    const trackedNames = new Set<string>();
    for (const file of walkFiles(appDir)) {
      const source = readFileSync(file, 'utf8');
      for (const call of parseTrackingCalls(source, file)) {
        trackedNames.add(call.name);
      }
    }

    for (const event of config.events) {
      if (!trackedNames.has(event.name)) {
        results.push({
          checkId: CHECK_ID,
          severity: 'critical',
          confidence: 'high',
          message: `Event "${event.name}" declared in releaselens.config but no tracking call found under ${config.appDir}.`,
          event: event.name,
        });
      }
    }

    const declaredNames = new Set(config.events.map((e) => e.name));
    for (const name of trackedNames) {
      if (!declaredNames.has(name)) {
        results.push({
          checkId: CHECK_ID,
          severity: 'warning',
          confidence: 'medium',
          message: `Tracking call \`${name}\` exists but is not declared in releaselens.config events.`,
          event: name,
        });
      }
    }

    return results;
  },
};

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SCAN_SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walkFiles(full);
    } else if (stat.isFile()) {
      const dotIdx = entry.lastIndexOf('.');
      if (dotIdx === -1) continue;
      const ext = entry.slice(dotIdx);
      if (SCAN_EXTENSIONS.has(ext)) {
        yield full;
      }
    }
  }
}
