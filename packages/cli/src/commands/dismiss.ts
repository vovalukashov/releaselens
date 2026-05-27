import { resolve } from 'node:path';
import { addDismissed, runChecks } from '@releaselens/core';
import pc from 'picocolors';
import { ConfigNotFoundError, loadConfig } from '../load-config.js';

const DISMISSED_PATH = '.releaselens/dismissed.json';

export interface DismissOptions {
  fingerprint: string;
  reason: string;
  configPath?: string;
}

export async function dismissCommand(opts: DismissOptions): Promise<void> {
  let loaded;
  try {
    loaded = await loadConfig(
      opts.configPath ? { explicit: opts.configPath } : {},
    );
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`Failed to load config: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const report = await runChecks(loaded.config);
  const finding = report.results.find(
    (r) => r.fingerprint === opts.fingerprint,
  );

  if (!finding) {
    process.stderr.write(
      `${pc.red('No finding matches fingerprint')} ${pc.bold(opts.fingerprint)}.\nRun ${pc.cyan('releaselens check')} to see current findings and their fingerprints.\n`,
    );
    process.exit(1);
  }

  const surface =
    finding.route ?? finding.form ?? finding.event ?? '(global)';
  const dismissedPath = resolve(process.cwd(), DISMISSED_PATH);
  addDismissed(dismissedPath, {
    fingerprint: opts.fingerprint,
    checkId: finding.checkId,
    surface,
    reason: opts.reason,
  });

  process.stdout.write(
    `${pc.green('Dismissed')} ${pc.bold(opts.fingerprint)} (${finding.checkId} on ${surface}).\n${pc.dim('Reason:')} ${opts.reason}\n`,
  );
}
