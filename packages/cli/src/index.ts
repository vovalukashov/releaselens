import { Command } from 'commander';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';

const program = new Command();

program
  .name('contentops')
  .description('Release-safety checks for code-first Next.js marketing sites.')
  .version('0.0.0');

program
  .command('init')
  .description('Scaffold a contentops.config.ts in the current directory.')
  .option('-d, --dir <dir>', 'Directory to scaffold into', process.cwd())
  .action(async (opts: { dir: string }) => {
    await initCommand({ dir: opts.dir });
  });

program
  .command('doctor')
  .description('Run release-safety checks against the current config.')
  .option('-c, --config <path>', 'Path to contentops.config.{ts,mjs,js}')
  .option('--ci', 'Exit with a non-zero status when errors are present.', false)
  .option('--json', 'Emit machine-readable JSON instead of text.', false)
  .action(
    async (opts: { config?: string; ci: boolean; json: boolean }) => {
      await doctorCommand({
        ...(opts.config ? { configPath: opts.config } : {}),
        ci: opts.ci,
        json: opts.json,
      });
    },
  );

await program.parseAsync();
