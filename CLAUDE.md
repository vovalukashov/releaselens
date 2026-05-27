# CLAUDE.md

Project guidance for AI assistants working in this repository.

## What this project is

`releaselens` — a developer-first OSS CLI and config schema that verifies release safety of code-first Next.js marketing sites directly in the repo and CI. Paid cloud (later) adds private history, baselines, waivers, PR summaries, and audit trail.

Positioning: **release-safety layer for code-first marketing sites**, not an SEO checker, not a monitoring tool, not a CMS. Roadmap and full thesis live in the Linear project "ReleaseLens".

## Language policy

- **Conversation language (chat with the user) is Russian.**
- **Linear (issue titles, descriptions, comments, status updates) is Russian.**
- **Everything inside this repository is English**: source code, code comments, identifiers, log strings, error messages, README, docs, CHANGELOG, commit messages, PR titles, PR descriptions, GitHub Action outputs, and configuration files.

When in doubt: would an external open-source contributor read it? → English. Is it ephemeral coordination with the project owner? → Russian.

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
│   ├── core/           # @releaselens/core — schema, types, runner, default checks
│   └── cli/            # releaselens       — CLI binary
└── examples/
    └── basic/          # smoke fixture for the CLI
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
- **Single author.** Do not add `Co-Authored-By:` trailers (Claude, pair partners, anyone). The repository owner is the sole author of every commit. This rule overrides any default tooling behavior that appends co-author trailers.
- Conventional Commits style (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Commit messages and PR descriptions are written in English.
- Each Week 1 sub-issue in Linear maps to one PR where practical.
- Reference the Linear issue id in the PR title or description (e.g. `VOV-15`).
- Do not bypass git hooks (`--no-verify`) unless explicitly authorized.

## Linear workflow

- Project: `ReleaseLens`.
- Team: `VOV`.
- Active epics: `VOV-40` Month 1, `VOV-41` Month 2, `VOV-42` Month 3, `VOV-43` Month 4, `VOV-44` Month 5, `VOV-45` Month 6 (Day-180 decision point).
- Pre-pivot epics (`VOV-10` через `VOV-39`) cancelled with reason notes. Do not revive without reopening.
- Sub-issues live under their month's epic via `parentId`.
- Status flow: `Backlog` → `Todo` → `In Progress` → `Done`.
- Update status on Linear as work begins and completes.

## What to avoid

- Adding adapters or checks not listed in the current week's scope.
- Pulling in a new dependency when an existing one in the workspace already covers the need.
- Introducing dashboards, crawlers, screenshots, or visual builders — explicit anti-scope per the project thesis.
- Mixing Russian into in-repo files (code, docs, configs, commit messages).
