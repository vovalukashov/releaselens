# ReleaseLens

> **Pre-merge contract diff for Next.js App Router marketing sites — before merge, not after deploy.**

[![npm](https://img.shields.io/npm/v/releaselens)](https://www.npmjs.com/package/releaselens)
[![CI](https://github.com/vovalukashov/releaselens/actions/workflows/ci.yml/badge.svg)](https://github.com/vovalukashov/releaselens/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/releaselens)](./LICENSE)

`releaselens` is a self-serve, OSS pre-merge contract checker for Next.js App Router marketing sites. On every pull request it diffs the contracts your revenue pages depend on — SEO metadata (title / description / canonical / hreflang / noindex, resolved the way Next.js resolves it), locale coverage, and Payload CMS block↔renderer wiring — and tells you what this change breaks before the merge button, not after the deploy.

It works by static analysis of your `app/` tree and CMS config — no crawler, no browser, no deployed preview. Not an AI code review. Not synthetic monitoring. Not visual regression. Not a CMS or observability backend. A thin orchestrator that runs targeted contract checks on revenue-critical web surfaces.

Two additional checks — forms and analytics events — ship as [experimental](#experimental-checks-forms--analytics): useful pre-merge tripwires, with their static-analysis limits documented honestly.

## Status

Pre-alpha. 8 core contract checks are live (SEO, locales, Payload CMS, config integrity), plus 2 experimental checks (forms, analytics events). The GitHub Action, FP-budget model, and AI explanations are all shipped.

## What it checks

Core contract checks — declarative surfaces where static analysis is the right tool; critical findings block CI:

| Check | What it catches |
| --- | --- |
| `seo-static` | Missing title / description / canonical / hreflang or an accidental noindex on a declared route, resolved through layout cascades, re-exports, and shared metadata bases. |
| `locales-static` | A locale variant missing its page or metadata — covers both subpath (`app/es/…`) and dynamic `[locale]` i18n models. |
| `payload-block-renderer` | A Payload CMS block with no matching frontend component — a renamed or new block whose renderer was never built. |
| `payload-route-cms-entry` | A route pointing at a Payload collection that does not exist. |
| `payload-locales-consistency` | Locale lists drifting between `releaselens.config.ts` and the Payload config. |
| `required-locales-exist`, `form-references-route`, `event-target-valid` | Config integrity — declarations referencing routes, forms, or locales that are not there. |

Experimental checks — behavioral surfaces where static analysis has known limits (see [Experimental checks](#experimental-checks-forms--analytics)):

| Check | What it catches |
| --- | --- |
| `forms-static` | A declared form whose selector no longer matches anything, or a form left without a submit mechanism. |
| `analytics-static` | A declared conversion event with no tracking call left in the code. |

## See it catch a regression

![releaselens catching a renamed Payload CMS block with no frontend renderer — before merge](docs/assets/demo.gif)

[`examples/next-marketing/broken-prs`](./examples/next-marketing/broken-prs) is the killer demo: a clean Next.js marketing app plus three "harmless" pull requests that pass type-checking and code review and ship green. The headline case is `03` — a renamed CMS block slug whose frontend renderer silently stops matching: pure contract drift, caught by `payload-block-renderer` before merge. The other two — a renamed form attribute (`01`) and a renamed analytics event (`02`) — exercise the experimental checks.

```bash
cd examples/next-marketing
./broken-prs/demo.sh   # applies each PR, runs releaselens, reverts — tree unchanged
```

## Quickstart

Try it with no install — `npx` fetches the CLI on the fly:

```bash
npx releaselens init     # scaffold releaselens.config.ts (sample route, form, event)
npx releaselens check    # run checks and print a report
```

`init` writes a starter config you edit to match your revenue surfaces; `check` tells you what this working tree would break.

releaselens is deliberately **not** a whole-site crawler. You list the handful of routes that move money — pricing, signup, checkout — under `routes`, and for each one it reads the page, its layouts, and `generateMetadata` from your `app/` tree to check title / description / canonical / hreflang / noindex. So you point at a route once instead of restating its metadata in config, but the checks only cover routes you declare. Forms and analytics events are declared the same way (see [Configuration](#configuration)).

More commands, when you need them:

```bash
npx releaselens check --ci               # exit non-zero on critical findings (use this in CI)
npx releaselens check --json             # machine-readable output
npx releaselens check --report           # also write releaselens-report.md (PR artifact)
npx releaselens check --update-baseline  # snapshot findings so only NEW issues surface (see FP-budget)
npx releaselens dismiss <fp> --reason "" # silence one finding by fingerprint
```

### For regular use

`npx` alone runs fine, but on an ongoing project add releaselens as a dev dependency — this types your config's `@releaselens/core` import in the editor and pins the version your CI runs against:

```bash
npm i -D releaselens     # or: pnpm add -D releaselens / yarn add -D releaselens
```

The devDependency pin matters more than it looks: the GitHub Action's tag pins the wrapper script, not the CLI — inside, it runs `npx --yes releaselens`, which uses your project's installed `releaselens` when present and otherwise resolves the **latest published** version.

For CI, the simplest path is the [GitHub Action](#github-action) — it installs releaselens, runs `check --ci`, and comments the findings on each pull request:

```yaml
- uses: vovalukashov/releaselens/actions/releaselens-check@v0.1.3
```

Or run it yourself in any CI step once dependencies are installed:

```bash
npm ci
npx releaselens check --ci   # exit non-zero on blocking critical findings
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

> **Honesty note:** `previewUrl`, `forms[].successState`, `events[].consent`, and `events[].requiredPayload` are validated and scaffolded by `init`, but not yet consumed by any check — they are forward-looking schema and will either gain checks or be removed in an upcoming release.

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

## Experimental checks (forms & analytics)

`forms-static` and `analytics-static` run whenever you declare `forms` or `events` — omit the declarations and they no-op. They are experimental because behavioral surfaces are where static analysis is weakest, and the limits are worth knowing before you gate CI on them:

- Both match **string literals only**. A dynamic attribute (`data-form={variant}`) never matches a selector, and `track(EVENTS.PRICING_SUBMIT)` is invisible to the analytics check.
- Form matching is **global across your source dirs**, not scoped to the declared `onRoute` — a matching attribute on a different page still counts as found.
- Verifying that a form actually submits or an event actually fires is runtime territory (Playwright, analytics-governance tools). These checks are cheap pre-merge tripwires for renamed or removed identifiers — not a replacement for runtime validation.

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

By default `analytics-static` is **forward-only**: it verifies that every event you declare in `events` actually has a tracking call (`event-not-tracked` — the regression that matters: a refactor silently dropped a conversion event). It does **not** flag tracking calls whose names you did not declare — a codebase with server telemetry, error tracking, or shared channels would otherwise be flooded with warnings for every internal event name. If your analytics surface is exactly your declared conversions and you want drift in the other direction caught too, opt in:

```ts
analytics: {
  requireDeclared: true, // also flag tracking calls not present in `events` (off by default)
},
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
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '20'
      - uses: vovalukashov/releaselens/actions/releaselens-check@v0.1.3
```

See [`actions/releaselens-check`](./actions/releaselens-check) for inputs and notes.

The examples pin the action to a release tag (`@v0.1.3`). For a hardened supply chain, pin to a full commit SHA instead (`@<sha>`) and let Dependabot bump it — a SHA can't be moved, a tag can. Avoid `@main`: it runs whatever is on the default branch at the time. Either way, the tag pins the wrapper, not the analyzer — the action runs `npx --yes releaselens`, which uses your project's installed `releaselens` when present and otherwise fetches the latest published CLI. Add `releaselens` to `devDependencies` to pin the analyzer itself.

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

Each finding carries `high | medium | low` confidence. Low-confidence criticals **do not block CI** even with `--ci` — they show up as warnings so dynamic-metadata cases do not produce false-positive failures. SEO missing-field findings are downgraded to low confidence only when the metadata is genuinely computed at runtime: a **dynamic spread** (`...getLocaleMetadata(...)`, or a base import the parser cannot resolve), a helper wrapper, or a `generateMetadata` function — because a static parser cannot prove a field is absent when it is computed per request. A spread of a **resolvable imported base** (`export const metadata = { ...baseMetadata, title }`) is different: the base is followed into its module and merged, so base+override metadata keeps **high** confidence and still blocks CI on a genuinely missing field. This keeps the common shared-base pattern from silently disabling SEO enforcement.

## Packages

| Package | Description |
| --- | --- |
| [`@releaselens/core`](./packages/core) | Config schema, types, check runner, FP-budget storage, core contract checks (SEO, locales, Payload CMS, config integrity) plus experimental forms/analytics checks, Payload adapter, AI explainer. |
| [`releaselens`](./packages/cli) | CLI binary (`init`, `check`, `dismiss`, `unmute`). |

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
- Not a runtime analytics validator (Avo, Trackingplan territory) — the forms/analytics checks here are static, experimental tripwires.
- Not a CMS or content authoring tool.
- Not an observability backend (Sentry, PostHog).

A thin orchestrator that runs targeted contract checks on revenue routes before merge.

## License

MIT.
