import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pc from 'picocolors';

const TEMPLATE = `import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  locales: ['en'],
  defaultLocale: 'en',

  // Core contract checks (SEO metadata, locales) run against the routes you
  // declare. List the pages that move money — pricing, signup, checkout.
  routes: [{ id: 'home', path: '/', businessImpact: 'high' }],

  // Payload CMS contract checks — point at your Payload config:
  // adapters: { payload: { config: './payload.config.ts' } },

  // Experimental checks (static tripwires with documented limits — see the
  // README before gating CI on them). Declare a form or event to enable:
  // forms: [
  //   { id: 'pricing-lead', onRoute: 'home', selector: '[data-form=pricing-lead]' },
  // ],
  // events: [
  //   { name: 'pricing_form_submit', onForm: 'pricing-lead' },
  // ],
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
