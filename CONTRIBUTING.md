# Contributing

Thanks for your interest in releaselens. This is an early OSS project — issues, repros, and pull requests are all welcome.

## Ground rules

- **Scope.** releaselens is a pre-merge contract gate for revenue-critical Next.js App Router surfaces — SEO metadata, locales, and CMS blocks at the core, plus experimental forms/analytics tripwires. It is intentionally *not* an SEO crawler, a synthetic monitor, a visual-regression tool, a runtime analytics validator, or a CMS. Changes that fit that frame are the ones most likely to be merged.
- **Repository language is English** — code, comments, identifiers, docs, commit messages, and PR descriptions.
- **Discuss big changes first.** For a new check, config field, or adapter, open an issue before a large PR.

## Development

Requires Node 24 LTS and pnpm. (The published `releaselens` and `@releaselens/core` packages only need Node 20+ — the 24 baseline is for building the monorepo.)

```bash
pnpm install
pnpm -w build
pnpm -w test
pnpm -w typecheck
pnpm -w lint
```

The workspace is a Turborepo monorepo:

- `packages/core` — `@releaselens/core`: config schema, types, the check runner, the default checks, and the Payload adapter.
- `packages/cli` — `releaselens`: the CLI binary.
- `examples/` — fixtures, including the `next-marketing` killer demo under `examples/next-marketing/broken-prs`.

## Dependencies

- **Exact pins only.** No `^`, `~`, or ranges in `dependencies`, `devDependencies`, or `peerDependencies`.
- A 3-day release cooldown is enforced (`minimumReleaseAge`): pnpm refuses any dependency version published less than three days ago. This is a supply-chain hygiene rule, not an oversight.

## Commits & PRs

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Keep the PR title short; put the detail in the description.
- Add or update tests alongside behavior changes, and keep `pnpm -w test` and `pnpm -w typecheck` green.

## Reporting bugs

A false positive or a missed regression is the most valuable kind of report. Include a minimal `releaselens.config.ts` plus the file(s) it checks — the smaller the repro, the faster the fix.
