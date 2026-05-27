import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { dismissCommand } from './commands/dismiss.js';
import { initCommand } from './commands/init.js';
import { pushCommand } from './commands/push.js';
import { unmuteCommand } from './commands/unmute.js';

const program = new Command();

program
  .name('releaselens')
  .description(
    'Pre-merge regression detector for Next.js revenue pages: SEO, forms, analytics, localization, CMS.',
  )
  .version('0.0.0');

program
  .command('init')
  .description('Scaffold a releaselens.config.ts in the current directory.')
  .option('-d, --dir <dir>', 'Directory to scaffold into', process.cwd())
  .action(async (opts: { dir: string }) => {
    await initCommand({ dir: opts.dir });
  });

program
  .command('check')
  .description('Run release-safety checks against the current config.')
  .option('-c, --config <path>', 'Path to releaselens.config.{ts,mjs,js}')
  .option(
    '--ci',
    'Exit with a non-zero status when critical findings are present.',
    false,
  )
  .option('--json', 'Emit machine-readable JSON instead of text.', false)
  .option(
    '--report [path]',
    'Write a markdown report to file (default: ./releaselens-report.md).',
    false,
  )
  .option(
    '--update-baseline',
    'Snapshot current findings to .releaselens/baseline.json. Subsequent runs ignore these fingerprints.',
    false,
  )
  .option(
    '--explain',
    'Attach AI-generated explanations to non-info findings (requires AI_GATEWAY_API_KEY).',
    false,
  )
  .option(
    '--upload',
    'Upload the report to the cloud backend (requires cloud config + token).',
    false,
  )
  .option('--pr <number>', 'PR number to attach when uploading.')
  .option('--branch <branch>', 'Branch name to attach when uploading.')
  .option('--commit <sha>', 'Commit SHA to attach when uploading.')
  .action(
    async (opts: {
      config?: string;
      ci: boolean;
      json: boolean;
      report: boolean | string;
      updateBaseline: boolean;
      explain: boolean;
      upload: boolean;
      pr?: string;
      branch?: string;
      commit?: string;
    }) => {
      await checkCommand({
        ...(opts.config ? { configPath: opts.config } : {}),
        ci: opts.ci,
        json: opts.json,
        report: opts.report,
        updateBaseline: opts.updateBaseline,
        explain: opts.explain,
        upload: opts.upload,
        ...(opts.pr ? { prNumber: opts.pr } : {}),
        ...(opts.branch ? { branch: opts.branch } : {}),
        ...(opts.commit ? { commit: opts.commit } : {}),
      });
    },
  );

program
  .command('push')
  .description(
    'Run checks and upload the report to the hosted backend (without printing locally).',
  )
  .option('-c, --config <path>', 'Path to releaselens.config.{ts,mjs,js}')
  .option('--pr <number>', 'PR number to attach.')
  .option('--branch <branch>', 'Branch name to attach.')
  .option('--commit <sha>', 'Commit SHA to attach.')
  .action(
    async (opts: {
      config?: string;
      pr?: string;
      branch?: string;
      commit?: string;
    }) => {
      await pushCommand({
        ...(opts.config ? { configPath: opts.config } : {}),
        ...(opts.pr ? { prNumber: opts.pr } : {}),
        ...(opts.branch ? { branch: opts.branch } : {}),
        ...(opts.commit ? { commit: opts.commit } : {}),
      });
    },
  );

program
  .command('dismiss <fingerprint>')
  .description(
    'Dismiss a finding by fingerprint. Adds entry to .releaselens/dismissed.json.',
  )
  .requiredOption('-r, --reason <reason>', 'Why this finding is dismissed.')
  .option('-c, --config <path>', 'Path to releaselens.config.{ts,mjs,js}')
  .action(
    async (
      fingerprint: string,
      opts: { reason: string; config?: string },
    ) => {
      await dismissCommand({
        fingerprint,
        reason: opts.reason,
        ...(opts.config ? { configPath: opts.config } : {}),
      });
    },
  );

program
  .command('unmute <checkId>')
  .description(
    'Remove auto-mute for a check on a surface (route, form, or event id).',
  )
  .requiredOption('-s, --surface <id>', 'Target surface id.')
  .action(async (checkId: string, opts: { surface: string }) => {
    await unmuteCommand({ checkId, surface: opts.surface });
  });

await program.parseAsync();
