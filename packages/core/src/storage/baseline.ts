import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const BASELINE_SCHEMA_VERSION = 2 as const;

export const BaselineSchema = z.object({
  version: z.literal(BASELINE_SCHEMA_VERSION),
  createdAt: z.string(),
  fingerprints: z.array(z.string()),
});
export type Baseline = z.infer<typeof BaselineSchema>;

/**
 * Read a baseline file. Returns `null` when the file is missing or contains a
 * legacy schema version (which uses fingerprints incompatible with the current
 * algorithm); in the legacy case, a warning is emitted on stderr so the user
 * knows to re-snapshot.
 */
export function readBaseline(filePath: string): Baseline | null {
  if (!existsSync(filePath)) return null;
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'version' in raw &&
    (raw as { version: unknown }).version !== BASELINE_SCHEMA_VERSION
  ) {
    const incoming = (raw as { version: unknown }).version;
    process.stderr.write(
      `releaselens: baseline.json schema v${String(incoming)} is incompatible with current v${BASELINE_SCHEMA_VERSION} fingerprints. ` +
        `Re-run \`releaselens check --update-baseline\` to refresh.\n`,
    );
    return null;
  }

  return BaselineSchema.parse(raw);
}

export function writeBaseline(filePath: string, fingerprints: string[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const baseline: Baseline = {
    version: BASELINE_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    fingerprints: [...new Set(fingerprints)].sort(),
  };
  writeFileSync(filePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}
