# site-doctor

> Release-safety checks for code-first Next.js marketing sites.

`site-doctor` is a developer-first CLI and config schema that verifies the operational contract of a marketing site directly in the repo and in CI. It answers a single question on every pull request: **is it safe to merge and ship this change to the marketing site?**

It is _not_ an SEO checker, _not_ a monitoring tool, _not_ a CMS. It is a thin policy and evidence layer on top of the stack you already use.

## Status

Pre-alpha. Week 1 of the validation roadmap — CLI skeleton, config schema, three stub checks. Real Next.js + Payload introspection lands in Week 2.

## Quickstart

```bash
pnpm add -D site-doctor          # placeholder, not published yet
npx site-doctor init             # scaffold site-doctor.config.ts
npx site-doctor doctor           # run checks and print a report
npx site-doctor doctor --ci      # exit non-zero on errors (for CI)
npx site-doctor doctor --json    # machine-readable output
```

A minimal config:

```ts
// site-doctor.config.ts
import { defineSiteDoctor } from '@site-doctor/core';

export default defineSiteDoctor({
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
| [`@site-doctor/core`](./packages/core) | Config schema, types, check runner, default checks. |
| [`site-doctor`](./packages/cli) | CLI binary. |

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
