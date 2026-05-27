import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

export const DismissedEntrySchema = z.object({
  fingerprint: z.string(),
  checkId: z.string(),
  surface: z.string(),
  reason: z.string(),
  dismissedAt: z.string(),
});
export type DismissedEntry = z.infer<typeof DismissedEntrySchema>;

export const DismissedSchema = z.object({
  version: z.literal(1),
  entries: z.array(DismissedEntrySchema),
});
export type Dismissed = z.infer<typeof DismissedSchema>;

export function readDismissed(filePath: string): Dismissed {
  if (!existsSync(filePath)) {
    return { version: 1, entries: [] };
  }
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  return DismissedSchema.parse(raw);
}

export function writeDismissed(filePath: string, data: Dismissed): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function addDismissed(
  filePath: string,
  entry: Omit<DismissedEntry, 'dismissedAt'>,
): Dismissed {
  const current = readDismissed(filePath);
  if (current.entries.some((e) => e.fingerprint === entry.fingerprint)) {
    return current;
  }
  const next: Dismissed = {
    version: 1,
    entries: [
      ...current.entries,
      { ...entry, dismissedAt: new Date().toISOString() },
    ],
  };
  writeDismissed(filePath, next);
  return next;
}

export function removeMute(
  filePath: string,
  checkId: string,
  surface: string,
): Dismissed {
  const current = readDismissed(filePath);
  const next: Dismissed = {
    version: 1,
    entries: current.entries.filter(
      (e) => !(e.checkId === checkId && e.surface === surface),
    ),
  };
  writeDismissed(filePath, next);
  return next;
}

export function isAutoMuted(
  dismissed: Dismissed,
  checkId: string,
  surface: string,
  threshold: number,
): boolean {
  const matching = dismissed.entries.filter(
    (e) => e.checkId === checkId && e.surface === surface,
  );
  return matching.length >= threshold;
}
