import { Command } from 'commander';
import { checkCommand } from './commands/check.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('releaselens')
  .description(
    'Pre-merge regression detector for Next.js revenue pages: SEO, forms, analytics, localization.',
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
  .action(
    async (opts: {
      config?: string;
      ci: boolean;
      json: boolean;
      report: boolean | string;
    }) => {
      await checkCommand({
        ...(opts.config ? { configPath: opts.config } : {}),
        ci: opts.ci,
        json: opts.json,
        report: opts.report,
      });
    },
  );

await program.parseAsync();
