import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const BaselineSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  fingerprints: z.array(z.string()),
});
export type Baseline = z.infer<typeof BaselineSchema>;

export function readBaseline(filePath: string): Baseline | null {
  if (!existsSync(filePath)) return null;
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  return BaselineSchema.parse(raw);
}

export function writeBaseline(filePath: string, fingerprints: string[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const baseline: Baseline = {
    version: 1,
    createdAt: new Date().toISOString(),
    fingerprints: [...new Set(fingerprints)].sort(),
  };
  writeFileSync(filePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
}
