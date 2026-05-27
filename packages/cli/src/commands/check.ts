import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runChecks } from '@releaselens/core';
import { ConfigNotFoundError, loadConfig } from '../load-config.js';
import { jsonReport } from '../reporters/json.js';
import { markdownReport } from '../reporters/markdown.js';
import { textReport } from '../reporters/text.js';

export interface CheckOptions {
  configPath?: string;
  ci: boolean;
  json: boolean;
  report: boolean | string;
}

const DEFAULT_REPORT_PATH = 'releaselens-report.md';

export async function checkCommand(opts: CheckOptions): Promise<void> {
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

  if (opts.report) {
    const reportPath =
      typeof opts.report === 'string' ? opts.report : DEFAULT_REPORT_PATH;
    const absReportPath = resolve(process.cwd(), reportPath);
    writeFileSync(
      absReportPath,
      markdownReport(report, loaded.path),
      'utf8',
    );
    if (!opts.json) {
      process.stdout.write(`Markdown report written to ${absReportPath}\n`);
    }
  }

  if (opts.ci && !report.passed) {
    process.exit(1);
  }
}
