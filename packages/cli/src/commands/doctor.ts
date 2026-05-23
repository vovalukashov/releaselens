import { runChecks } from '@site-doctor/core';
import { ConfigNotFoundError, loadConfig } from '../load-config.js';
import { jsonReport } from '../reporters/json.js';
import { textReport } from '../reporters/text.js';

export interface DoctorOptions {
  configPath?: string;
  ci: boolean;
  json: boolean;
}

export async function doctorCommand(opts: DoctorOptions): Promise<void> {
  let loaded;
  try {
    loaded = await loadConfig(
      opts.configPath ? { explicit: opts.configPath } : {},
    );
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(opts.ci ? 1 : 0);
    }
    process.stderr.write(`Failed to load config: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const report = await runChecks(loaded.config);

  if (opts.json) {
    process.stdout.write(`${jsonReport(report)}\n`);
  } else {
    process.stdout.write(textReport(report, loaded.path));
  }

  if (opts.ci && !report.passed) {
    process.exit(1);
  }
}
