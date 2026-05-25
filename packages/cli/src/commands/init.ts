import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pc from 'picocolors';

const TEMPLATE = `import { defineContentOps } from '@contentops/core';

export default defineContentOps({
  framework: 'next',
  cms: 'none',
  hosting: 'vercel',
  locales: ['en', 'es'],
  defaultLocale: 'en',
  routes: [
    {
      id: 'home',
      path: '/',
      requiredLocales: ['en', 'es'],
      requiredMetadata: ['title', 'description', 'canonical', 'hreflang'],
    },
  ],
});
`;

export interface InitOptions {
  dir: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const target = resolve(opts.dir, 'contentops.config.ts');

  if (existsSync(target)) {
    process.stderr.write(
      `${pc.yellow('contentops.config.ts already exists at')} ${pc.bold(target)}\n`,
    );
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, TEMPLATE, 'utf8');

  process.stdout.write(
    `${pc.green('Created')} ${pc.bold(target)}\nNext: ${pc.cyan('npx contentops doctor')}\n`,
  );
}
