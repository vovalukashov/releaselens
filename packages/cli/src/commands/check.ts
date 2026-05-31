import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { explainFindings, runChecks, writeBaseline } from '@releaselens/core';
import pc from 'picocolors';
import { ConfigNotFoundError, loadConfig } from '../load-config.js';
import { pushCommand } from './push.js';
import { jsonReport } from '../reporters/json.js';
import { markdownReport } from '../reporters/markdown.js';
import { textReport } from '../reporters/text.js';

export interface CheckOptions {
  configPath?: string;
  ci: boolean;
  json: boolean;
  report: boolean | string;
  updateBaseline: boolean;
  explain: boolean;
  upload: boolean;
  prNumber?: string;
  branch?: string;
  commit?: string;
}

const DEFAULT_REPORT_PATH = 'releaselens-report.md';
const BASELINE_PATH = '.releaselens/baseline.json';

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

  const report = await runChecks(loaded.config, {
    skipFilters: opts.updateBaseline,
  });

  if (opts.updateBaseline) {
    const baselinePath = resolve(process.cwd(), BASELINE_PATH);
    const fingerprints = report.results
      .map((r) => r.fingerprint)
      .filter((fp): fp is string => Boolean(fp));
    writeBaseline(baselinePath, fingerprints);
    process.stdout.write(
      `${pc.green('Baseline updated')} ${pc.bold(baselinePath)} (${fingerprints.length} fingerprints).\n`,
    );
    return;
  }

  if (opts.explain) {
    const nonInfo = report.results.filter((r) => r.severity !== 'info');
    const explained = await explainFindings(nonInfo);
    const explainedById = new Map(explained.map((e) => [e.fingerprint, e]));
    report.results = report.results.map((r) => {
      const match = r.fingerprint ? explainedById.get(r.fingerprint) : undefined;
      return match ?? r;
    });
  }

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

  if (opts.upload) {
    try {
      await pushCommand({
        ...(opts.configPath ? { configPath: opts.configPath } : {}),
        ...(opts.prNumber ? { prNumber: opts.prNumber } : {}),
        ...(opts.branch ? { branch: opts.branch } : {}),
        ...(opts.commit ? { commit: opts.commit } : {}),
        report,
      });
    } catch (err) {
      process.stderr.write(`Upload error: ${(err as Error).message}\n`);
    }
  }

  if (opts.ci && !report.passed) {
    process.exit(1);
  }
}
