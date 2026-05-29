# ReleaseLens

> **Tell me what this PR breaks before it ships.**

`releaselens` is a self-serve, OSS pre-merge regression detector for Next.js revenue pages. On every pull request it tells you which routes, forms, analytics events, locales, or SEO tags this change can break — before the merge button.

Not an AI code review. Not synthetic monitoring. Not visual regression. Not a CMS or observability backend. A thin orchestrator that runs targeted checks on revenue-critical web surfaces.

## Status

Pre-alpha — Month 6 (final) of 6-month execution. Day-180 evaluation pending. All 10 default checks live (SEO, forms, analytics, locales, Payload CMS, plus 4 config-integrity checks). GitHub Action + FP-budget + AI explanations + hosted cloud scaffold all shipped. See the [Linear project](https://linear.app/vovas-workspace/project/releaselens-b530bf7260a9) for the live roadmap.

## Quickstart

```bash
pnpm add -D releaselens          # placeholder, not published yet
npx releaselens init             # scaffold releaselens.config.ts
npx releaselens check                            # run checks and print a report
npx releaselens check --ci                       # exit non-zero on critical findings
npx releaselens check --json                     # machine-readable output
npx releaselens check --report                   # also write releaselens-report.md (for PR artifacts)
npx releaselens check --update-baseline          # snapshot current findings to .releaselens/baseline.json
npx releaselens dismiss <fp> --reason "..."      # silence a specific finding by fingerprint
npx releaselens unmute <checkId> --surface <id>  # restore auto-muted check
npx releaselens check --upload --pr 42           # upload report to hosted backend
npx releaselens push --pr 42                     # alias: run + upload only
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

## GitHub Action

```yaml
name: ReleaseLens
on:
  pull_request:
    branches: [main]
permissions:
  pull-requests: write
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - uses: vovalukashov/releaselens/actions/releaselens-check@main
```

See [`actions/releaselens-check`](./actions/releaselens-check) for inputs and notes.

## Packages

| Package | Description |
| --- | --- |
| [`@releaselens/core`](./packages/core) | Config schema, types, check runner, FP-budget storage, 10 default checks, Payload adapter, AI explainer. |
| [`releaselens`](./packages/cli) | CLI binary (`init`, `check`, `push`, `dismiss`, `unmute`). |
| [`@releaselens/cloud`](./apps/cloud) | Hosted backend (Next.js + Drizzle + Neon + Stripe). Deployable on Vercel. |

## Development

Requires Node 24 LTS and pnpm.

```bash
pnpm install
pnpm -w build
pnpm -w test
pnpm -w typecheck
```

Or use the **dev container** (GitHub Codespaces, VS Code / Cursor Dev Containers, JetBrains) — includes Node 24, pnpm 11, gh CLI, Docker-in-Docker, **Claude Code CLI**, and pre-built packages. See [`docs/dispatch.md`](./docs/dispatch.md) for routine setup and the env var matrix.

## What this is NOT

- Not an AI code review (Copilot, Cursor, CodeRabbit, Qodo territory).
- Not a synthetic monitoring cloud (Checkly).
- Not visual regression (Chromatic, Lost Pixel, Argos).
- Not a CMS or content authoring tool.
- Not an observability backend (Sentry, PostHog).

A thin orchestrator that runs targeted checks on revenue routes before merge.

## License

MIT.
