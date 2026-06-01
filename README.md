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
    // Match by any string attribute — data-form, name, id, aria-label,
    // data-testid, role, etc. Multiple clauses are ANDed.
    { id: 'pricing-lead', onRoute: 'pricing', selector: '[data-form=pricing-lead]',  successState: { type: 'route', value: '/thank-you' } },
    { id: 'subscribe',    onRoute: 'home',    selector: '[name=email-subscribe]',    successState: { type: 'route', value: '/thanks' } },
    { id: 'book-demo',    onRoute: 'pricing', selector: '[id=demo][aria-label="Book a demo"]', successState: { type: 'route', value: '/demo-thanks' } },
    // Or by file path suffix — useful for react-hook-form patterns that have
    // no identifying attribute on the <form> tag.
    { id: 'lead',         onRoute: 'pricing', selector: 'file:book-a-demo-call/client.tsx',    successState: { type: 'route', value: '/ok' } },
    // Native `<form>`, the next/form `<Form action="/search">` primitive, and
    // Server Action forms (`<form action={fn}>`) are all recognised; the
    // `action` prop counts as a submit mechanism (so does onSubmit / a submit button).
  ],
  events: [
    {
      name: 'pricing_form_submit',
      onForm: 'pricing-lead',
      consent: 'analytics',
    },
  ],
  // analytics-static recognises `track`, `posthog.capture`, `analytics.track`,
  // and `gtag('event', …)` out of the box. Custom wrappers are declared here.
  analytics: {
    trackers: [
      'sendEvent',            // identifier call: sendEvent(name, …)
      'mixpanel.track',       // member access: mixpanel.track(name, …)
      '_sendEvent@1',         // name at arg 1: _sendEvent(host, name, …)
      'gtag:event',           // first arg must equal 'event'; built-in
      'track#event',          // object arg: track({ event: name, … })
      'logEvent@1#name',      // object at arg 1: logEvent(ctx, { name, … })
    ],
  },
});
```

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
          node-version: '24'
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
| [`@releaselens/cloud`](./apps/cloud) | Hosted backend (Next.js + Drizzle + Neon + Stripe). Deployable on Vercel. |

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
