import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pc from 'picocolors';

const TEMPLATE = `import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  previewUrl: { source: 'vercel' },
  locales: ['en', 'es'],
  defaultLocale: 'en',
  routes: [
    {
      id: 'pricing',
      path: '/pricing',
      businessImpact: 'high',
      locales: ['en', 'es'],
    },
  ],
  forms: [
    {
      id: 'pricing-lead',
      onRoute: 'pricing',
      selector: '[data-form=pricing-lead]',
      successState: { type: 'route', value: '/thank-you' },
    },
  ],
  events: [
    {
      name: 'pricing_form_submit',
      onForm: 'pricing-lead',
      consent: 'analytics',
    },
  ],
});
`;

export interface InitOptions {
  dir: string;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const target = resolve(opts.dir, 'releaselens.config.ts');

  if (existsSync(target)) {
    process.stderr.write(
      `${pc.yellow('releaselens.config.ts already exists at')} ${pc.bold(target)}\n`,
    );
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, TEMPLATE, 'utf8');

  process.stdout.write(
    `${pc.green('Created')} ${pc.bold(target)}\nNext: ${pc.cyan('npx releaselens check')}\n`,
  );
}
