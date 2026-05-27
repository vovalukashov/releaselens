# ReleaseLens

> **Tell me what this PR breaks before it ships.**

`releaselens` is a self-serve, OSS pre-merge regression detector for Next.js revenue pages. On every pull request it tells you which routes, forms, analytics events, locales, or SEO tags this change can break — before the merge button.

Not an AI code review. Not synthetic monitoring. Not visual regression. Not a CMS or observability backend. A thin orchestrator that runs targeted checks on revenue-critical web surfaces.

## Status

Pre-alpha — Month 1 of 6-month execution. Static-only checks. GitHub Action lands Month 2. Real Next.js metadata parsing, form smoke, and analytics contract validation roll in across Months 1–4. See the Linear project for the live roadmap.

## Quickstart

```bash
pnpm add -D releaselens          # placeholder, not published yet
npx releaselens init             # scaffold releaselens.config.ts
npx releaselens check            # run checks and print a report
npx releaselens check --ci       # exit non-zero on critical findings
npx releaselens check --json     # machine-readable output
```

A minimal config:

```ts
// releaselens.config.ts
import { defineReleaseLens } from '@releaselens/core';

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
```

## Packages

| Package | Description |
| --- | --- |
| [`@releaselens/core`](./packages/core) | Config schema, types, check runner, default checks. |
| [`releaselens`](./packages/cli) | CLI binary. |

## Development

Requires Node 24 LTS and pnpm.

```bash
pnpm install
pnpm -w build
pnpm -w test
pnpm -w typecheck
```

## What this is NOT

- Not an AI code review (Copilot, Cursor, CodeRabbit, Qodo territory).
- Not a synthetic monitoring cloud (Checkly).
- Not visual regression (Chromatic, Lost Pixel, Argos).
- Not a CMS or content authoring tool.
- Not an observability backend (Sentry, PostHog).

A thin orchestrator that runs targeted checks on revenue routes before merge.

## License

MIT.
