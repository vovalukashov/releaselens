# ReleaseLens

> **Tell me what this PR breaks before it ships.**

`releaselens` is a self-serve, OSS pre-merge regression detector for Next.js revenue pages. On every pull request it tells you which routes, forms, analytics events, locales, or SEO tags this change can break — before the merge button.

Not an AI code review. Not synthetic monitoring. Not visual regression. Not a CMS or observability backend. A thin orchestrator that runs targeted checks on revenue-critical web surfaces.

## Status

Pre-alpha. All 10 default checks are live (SEO, forms, analytics, locales, Payload CMS, plus 3 config-integrity checks). The GitHub Action, FP-budget model, and AI explanations are all shipped.

## Quickstart

```bash
pnpm add -D releaselens     # the CLI
npx releaselens init        # scaffold releaselens.config.ts (with a sample route, form, event)
npx releaselens check       # run checks and print a report
```

`init` writes a starter config you edit to match your revenue surfaces; `check` tells you what this working tree would break.

releaselens is deliberately **not** a whole-site crawler. You list the handful of routes that move money — pricing, signup, checkout — under `routes`, and for each one it reads the page, its layouts, and `generateMetadata` from your `app/` tree to check title / description / canonical / hreflang / noindex. So you point at a route once instead of restating its metadata in config, but the checks only cover routes you declare. Forms and analytics events are declared the same way (see [Configuration](#configuration)).

Then wire it into CI with the [GitHub Action](#github-action) to get a findings comment on every pull request.

More commands, when you need them:

```bash
npx releaselens check --ci               # exit non-zero on critical findings (use this in CI)
npx releaselens check --json             # machine-readable output
npx releaselens check --report           # also write releaselens-report.md (PR artifact)
npx releaselens check --update-baseline  # snapshot findings so only NEW issues surface (see FP-budget)
npx releaselens dismiss <fp> --reason "" # silence one finding by fingerprint
npx releaselens push --pr 42             # run + upload report to the hosted backend
```

## Configuration

`releaselens init` scaffolds `releaselens.config.ts`. List each revenue route under `routes` — that's what the SEO and locale checks run against. Add `forms` and `events` for the surfaces you want those checks to cover:

```ts
// releaselens.config.ts
import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  previewUrl: { source: 'vercel' },
  locales: ['en', 'es'],
  defaultLocale: 'en',
  routes: [
    { id: 'pricing', path: '/pricing', businessImpact: 'high', locales: ['en', 'es'] },
  ],
  forms: [
    { id: 'pricing-lead', onRoute: 'pricing', selector: '[data-form=pricing-lead]', successState: { type: 'route', value: '/thank-you' } },
  ],
  events: [
    { name: 'pricing_form_submit', onForm: 'pricing-lead', consent: 'analytics' },
  ],
});
```

### Forms

Match a form by any string attribute — `data-form`, `name`, `id`, `aria-label`, `data-testid`, `role`. Multiple clauses are ANDed:

```ts
forms: [
  { id: 'pricing-lead', onRoute: 'pricing', selector: '[data-form=pricing-lead]', successState: { type: 'route', value: '/thank-you' } },
  { id: 'subscribe',    onRoute: 'home',    selector: '[name=email-subscribe]',   successState: { type: 'route', value: '/thanks' } },
  { id: 'book-demo',    onRoute: 'pricing', selector: '[id=demo][aria-label="Book a demo"]', successState: { type: 'route', value: '/demo-thanks' } },
  // Or match by file path suffix — for react-hook-form patterns with no identifying attribute on the <form> tag:
  { id: 'lead',         onRoute: 'pricing', selector: 'file:book-a-demo-call/client.tsx', successState: { type: 'route', value: '/ok' } },
],
```

Native `<form>`, the next/form `<Form action="/search">` primitive, and Server Action forms (`<form action={fn}>`) all count as real forms — the `action` prop is a valid submit mechanism, and so is an `onSubmit` handler or a submit button.

### Analytics events

`analytics-static` recognises `track`, `posthog.capture`, `analytics.track`, and `gtag('event', …)` out of the box. Declare custom wrappers under `analytics.trackers`:

```ts
analytics: {
  trackers: [
    'sendEvent',        // sendEvent(name, …)        — plain call, event name is arg 0
    'mixpanel.track',   // mixpanel.track(name, …)   — method call, event name is arg 0
    '_sendEvent@1',     // _sendEvent(host, name, …) — event name is arg 1
    'gtag:event',       // gtag('event', name)       — arg 0 must equal 'event' (built-in)
    'track#event',      // track({ event: name, … }) — event name is the `event` property
    'logEvent@1#name',  // logEvent(ctx, { name, … })— object at arg 1, name is its `name` property
  ],
},
```

The grammar reads left to right: `callee` (a plain name or `obj.method`), optional `@N` for the argument index (default 0), optional `#prop` when the event name lives in a property of an object argument instead of being a bare string.

## SEO metadata resolution

`seo-static` resolves a route's effective metadata the way Next.js does, then checks for missing title / description / canonical / hreflang / noindex. It understands:

- inline `export const metadata = { … }` and `export async function generateMetadata()`;
- helper wrappers (`export const metadata = setMetadata({ … })`);
- layout cascade — a page inherits `metadata` declared in any parent `layout`;
- **re-export from a separate module** — `export { default as metadata } from '@/contents/metadata'`. The check follows the specifier (relative paths and tsconfig `paths` aliases) into the module that holds the object and reads the real fields, so a page whose title/description live in a shared contents file is not falsely flagged;
- **shared base metadata** — `export const metadata = defaultMetadata` (imported identifier) and spreads such as `export const metadata = { ...defaultMetadata, title: '…' }`. The imported base is resolved into its module and merged, so pages and layouts built on a common base object keep their inherited title/description/canonical.

## Localization models

`locales-static` understands the two ways a Next.js App Router site does i18n:

- **Subpath dirs** — a physical page tree per locale (`app/es/pricing/page.tsx`). For each route with `locales`, the check looks up the localized file and compares its metadata against the default locale (missing page, missing/duplicated canonical, etc.).
- **Dynamic `[locale]` segment** (next-intl / next-i18next) — one physical page (`app/[locale]/[slug]/page.tsx`) serves every locale through the URL param. The check detects this automatically when a route path contains the locale segment and **does not** expect a per-locale file. Instead it flags a route that exports **static** `metadata`: a module-scope object can't read the `[locale]` param, so title, description and canonical would be identical for every locale and no hreflang is emitted — use `generateMetadata({ params })` to vary them per locale.

The dynamic segment defaults to `[locale]`. If yours is named differently (e.g. `[lang]`), set `localeParam` at the config root:

```ts
export default defineReleaseLens({
  localeParam: 'lang',
  routes: [{ id: 'home', path: '/[lang]', locales: ['en', 'es'] }],
});
```

## Payload CMS

When `adapters.payload` points at your `payload.config.ts`, releaselens loads it (heavy editor/db/storage imports are stubbed, so no database or build is needed) and extracts a normalized content model: collections, globals, localization, and **blocks**. Blocks are discovered both from `type: 'blocks'` fields and from the lexical rich-text editor — `lexicalEditor({ features: [BlocksFeature({ blocks: [...] })] })`, including blocks nested inside other blocks. The `payload-block-renderer` check then verifies every block slug has a matching frontend component, catching CMS-model/renderer drift (a renamed or new block whose renderer was never built).

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
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '20'
      - uses: vovalukashov/releaselens/actions/releaselens-check@main
```

See [`actions/releaselens-check`](./actions/releaselens-check) for inputs and notes.

## FP-budget (baseline + dismiss + auto-mute)

ReleaseLens is opinionated about *not* drowning you in legacy noise. Three layered mechanisms keep the signal high:

### Baseline

```bash
npx releaselens check --update-baseline   # snapshot current findings
git add .releaselens/baseline.json
```

`.releaselens/baseline.json` stores a fingerprint per finding so subsequent runs surface only **new** issues. Each fingerprint is `sha1(checkId + issueKey + route + form + event + locale)` — two different issues on the same surface (e.g. `missing-canonical` and `missing-hreflang` on `/pricing`) get **distinct** fingerprints, so resolving one does not silently unmute the other. The schema is versioned (currently `v2`); a legacy baseline triggers a warning telling you to re-snapshot.

`--update-baseline` always re-snapshots the **full current state**, not just deltas since the previous baseline. Re-running it on a clean tree is safe — the file ends up with the same fingerprints, not an empty list.

### Dismiss

```bash
npx releaselens dismiss <fingerprint> --reason "legacy, pending redesign"
```

Persists in `.releaselens/dismissed.json` and **hides that specific fingerprint** on subsequent runs. Use this when a finding is correct but intentionally ignored — leaves an auditable reason.

### Auto-mute

When three distinct fingerprints on the same `(checkId, surface)` have been dismissed, the entire surface auto-mutes and any **new** fingerprint of the same kind is suppressed too (saves you from dismissing endless variants). Restore explicitly — this also clears the single-fingerprint dismisses for that surface:

```bash
npx releaselens unmute <checkId> --surface <id>
```

### Confidence levels

Each finding carries `high | medium | low` confidence. Low-confidence criticals **do not block CI** even with `--ci` — they show up as warnings so dynamic-metadata cases do not produce false-positive failures. SEO missing-field findings are downgraded to low confidence whenever the metadata is dynamic: a spread (`return setMetadata({ ...getLocaleMetadata(...) })`), a helper wrapper, or a `generateMetadata` function — because a static parser cannot prove a field is absent when it is computed per request from params or the CMS.

## Packages

| Package | Description |
| --- | --- |
| [`@releaselens/core`](./packages/core) | Config schema, types, check runner, FP-budget storage, 10 default checks, Payload adapter, AI explainer. |
| [`releaselens`](./packages/cli) | CLI binary (`init`, `check`, `push`, `dismiss`, `unmute`). |

## Development

Developing this repo requires Node 24 LTS and pnpm. (The published `releaselens` and `@releaselens/core` packages only need Node 20+ — the 24 baseline is for building the monorepo.)

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
