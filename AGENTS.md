# AGENTS.md

Project guidance for AI assistants working in this repository.

## What this project is

`releaselens` — a developer-first OSS CLI and config schema that runs pre-merge contract checks on code-first Next.js App Router marketing sites, directly in the repo and CI.

Positioning: **pre-merge contract diff for Next.js App Router marketing sites — before merge, not after deploy**. Core checks are the contract surfaces where static analysis is strong: SEO metadata, locale coverage, Payload CMS block↔renderer wiring, config integrity. Forms and analytics checks are **experimental** tripwires — behavioral surfaces where static analysis has documented limits. Not an SEO checker, not a monitoring tool, not a runtime analytics validator, not a CMS.

## Language policy

All repository content is **English**: source code, code comments, identifiers, log strings, error messages, README, docs, CHANGELOG, commit messages, PR titles, PR descriptions, GitHub Action outputs, and configuration files.

## Dependency policy

- **Exact pins only.** Every entry in `dependencies`, `devDependencies`, and `peerDependencies` is a fixed version. No `^`, no `~`, no `latest`, no ranges. Use `pnpm add <pkg>@<exact-version>` or edit `package.json` and run `pnpm install`.
- **3-day release cooldown.** `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320` (minutes). pnpm refuses to install any version of a dependency published less than 3 days ago. This is a supply-chain hygiene rule — fresh releases sit until the wider ecosystem has had a chance to flag bad ones.
- **Cooldown exclusions** are listed in `minimumReleaseAgeExclude` (workspace-internal packages only).
- **Bumps are deliberate.** When upgrading, pick the latest stable version that satisfies the LTS policy, pin it exactly, run `pnpm install --frozen-lockfile=false`, then commit the updated `pnpm-lock.yaml`.
- **No `pnpm update`** without a specific target — it sweeps a lot of versions at once and skips the deliberateness this policy is about.

## Tooling baseline

Use the **latest LTS / stable** version of every runtime and package, subject to the dependency policy above. Do not pin older majors without an explicit compatibility reason.

- Node.js: **24 LTS** (`.nvmrc`, `engines.node`).
- Package manager: **pnpm** (latest stable, pinned via `packageManager` field).
- Monorepo orchestrator: **Turborepo** (latest 2.x).
- Language: **TypeScript** (latest stable 5.x), strict mode, ES2022 target, NodeNext modules.
- Bundler: **tsup** (ESM-only output).
- Tests: **Vitest**.
- Config schema: **Zod**.
- CLI parsing: **Commander**.
- Terminal colors: **picocolors**.
- TS runtime loader for config files: **jiti**.
- Lint/format: **ESLint** (flat config) + **Prettier**.

Run everything through Turbo at the repo root:

```bash
pnpm install
pnpm -w build
pnpm -w test
pnpm -w typecheck
pnpm -w lint
```

## Repository layout

```
.
├── packages/
│   ├── core/            # @releaselens/core — schema, types, runner, default checks
│   └── cli/             # releaselens       — CLI binary
├── actions/
│   └── releaselens-check/  # composite GitHub Action wrapping the CLI
├── docs/                # operational docs (dispatch routines)
└── examples/
    ├── basic/           # smoke fixture for the CLI
    └── next-marketing/  # demo app + broken-prs killer-demo patches
```

New first-party packages go under `packages/*`. Demo or fixture apps go under `examples/*`. Both globs are listed in `pnpm-workspace.yaml`.

## Code conventions

- ESM only. No CommonJS in source.
- Public API surface of each package is its `src/index.ts`. Do not import from deep paths across packages.
- Public types are exported from `@releaselens/core`. Adapters and the CLI consume them.
- Default to writing no comments. Only add a comment when the *why* is non-obvious. Never document *what* well-named code already says.
- No backwards-compatibility shims, no unused re-exports, no half-finished branches.
- Validate at boundaries (CLI args, config files, external adapter inputs). Trust internal calls.

## Commits and PRs

- **Commits carry a subject line only — no body.** Use `git commit -m "<subject>"`. Do not use HEREDOC, multi-line `-m`, or commit body for any reason. Details go in the PR description.
- **Single author.** Do not add `Co-Authored-By:` trailers (Codex, pair partners, anyone). The repository owner is the sole author of every commit. This rule overrides any default tooling behavior that appends co-author trailers.
- Conventional Commits style (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Commit messages and PR descriptions are written in English.
- Do not bypass git hooks (`--no-verify`) unless explicitly authorized.

## What to avoid

- Adding adapters or checks beyond the agreed scope.
- Pulling in a new dependency when an existing one in the workspace already covers the need.
- Introducing dashboards, crawlers, screenshots, or visual builders — explicit anti-scope.
- Mixing non-English content into in-repo files (code, docs, configs, commit messages).
