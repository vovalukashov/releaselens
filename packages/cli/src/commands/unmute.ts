import { resolve } from 'node:path';
import { removeMute } from '@releaselens/core';
import pc from 'picocolors';

const DISMISSED_PATH = '.releaselens/dismissed.json';

export interface UnmuteOptions {
  checkId: string;
  surface: string;
}

export async function unmuteCommand(opts: UnmuteOptions): Promise<void> {
  const dismissedPath = resolve(process.cwd(), DISMISSED_PATH);
  const next = removeMute(dismissedPath, opts.checkId, opts.surface);
  process.stdout.write(
    `${pc.green('Unmuted')} ${pc.bold(opts.checkId)} on ${pc.bold(opts.surface)}. ${pc.dim(`${next.entries.length} dismissals remain.`)}\n`,
  );
}
