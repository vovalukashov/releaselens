import { runChecks, type RunReport } from '@releaselens/core';
import pc from 'picocolors';
import { ConfigNotFoundError, loadConfig } from '../load-config.js';

export interface PushOptions {
  configPath?: string;
  prNumber?: string;
  branch?: string;
  commit?: string;
  report?: RunReport;
}

export async function pushCommand(opts: PushOptions): Promise<void> {
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

  const cloud = loaded.config.cloud;
  if (!cloud) {
    process.stderr.write(
      `${pc.red('No cloud config set.')} Add \`cloud: { project: "<owner>/<repo>" }\` to releaselens.config.ts.\n`,
    );
    process.exit(1);
  }

  const token = process.env[cloud.tokenEnv];
  if (!token) {
    process.stderr.write(
      `${pc.red('Cloud token missing.')} Set env var ${pc.bold(cloud.tokenEnv)} with your ReleaseLens API token.\n`,
    );
    process.exit(1);
  }

  const report = opts.report ?? (await runChecks(loaded.config));

  const body = {
    report,
    ...(opts.prNumber ? { prNumber: opts.prNumber } : {}),
    ...(opts.branch ? { branch: opts.branch } : {}),
    ...(opts.commit ? { commit: opts.commit } : {}),
  };

  const res = await fetch(`${cloud.endpoint}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    process.stderr.write(
      `${pc.red(`Upload failed: HTTP ${res.status}`)} — ${text}\n`,
    );
    process.exit(1);
  }

  const data = (await res.json()) as { id?: string };
  process.stdout.write(
    `${pc.green('Uploaded report')} ${pc.bold(data.id ?? '')} ${pc.dim(`→ ${cloud.endpoint}`)}\n`,
  );
}
