# ContentOps Doctor

> Release-safety checks for code-first Next.js marketing sites.

`contentops` is a developer-first CLI and config schema that verifies the operational contract of a marketing site directly in the repo and in CI. It answers a single question on every pull request: **is it safe to merge and ship this change to the marketing site?**

It is _not_ an SEO checker, _not_ a monitoring tool, _not_ a CMS. It is a thin policy and evidence layer on top of the stack you already use.

## Status

Pre-alpha. Week 1 of the validation roadmap — CLI skeleton, config schema, three stub checks. Real Next.js + Payload introspection lands in Week 2.

## Quickstart

```bash
pnpm add -D contentops          # placeholder, not published yet
npx contentops init             # scaffold contentops.config.ts
npx contentops doctor           # run checks and print a report
npx contentops doctor --ci      # exit non-zero on errors (for CI)
npx contentops doctor --json    # machine-readable output
```

A minimal config:

```ts
// contentops.config.ts
import { defineContentOps } from '@contentops/core';

export default defineContentOps({
  framework: 'next',
  cms: 'payload',
  hosting: 'vercel',
  locales: ['en', 'es'],
  defaultLocale: 'en',
  routes: [
    {
      id: 'pricing',
      path: '/pricing',
      cms: { collection: 'pages', slug: 'pricing' },
      requiredLocales: ['en', 'es'],
      requiredMetadata: ['title', 'description', 'canonical', 'hreflang'],
    },
  ],
});
```

## Packages

| Package | Description |
| --- | --- |
| [`@contentops/core`](./packages/core) | Config schema, types, check runner, default checks. |
| [`contentops`](./packages/cli) | CLI binary. |

## Development

Requires Node 24 LTS and pnpm.

```bash
pnpm install
pnpm -w build
pnpm -w test
pnpm -w typecheck
```

## What this is NOT

- Not a CMS, visual builder, or content authoring tool.
- Not a crawler or synthetic monitoring service.
- Not a runtime analytics or experimentation platform.
- Not an SEO content auditor.

It is a **pre-release policy and evidence layer** that runs deterministically in your CI alongside ESLint, TypeScript, and Playwright.

## License

MIT.
