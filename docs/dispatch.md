# Dispatch + Dev Container

Run ReleaseLens maintenance tasks autonomously via Claude Code — either locally in a dev container (Codespaces, VS Code, Cursor, JetBrains) or unattended through Claude Code's cloud routines.

## 1. Local dev container

File: [`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json).

Base: Ubuntu + Node 24 (via Dev Container Feature) + pnpm 11 + corepack + GitHub CLI + Docker-in-Docker + **Claude Code feature** (`ghcr.io/anthropics/devcontainer-features/claude-code:1.0`).

Persistent volumes:
- `releaselens-pnpm-store` — pnpm content-addressable store survives rebuilds.
- `claude-code-config-${devcontainerId}` — `~/.claude` per-project state (auth token, history).

Bring up:
```bash
# In Codespaces: "Code" → "Create codespace on main"
# In VS Code / Cursor: Dev Containers extension → "Reopen in Container"
# In JetBrains: Dev Containers plugin → open repo
```

`post-create.sh` runs once: enables corepack, pins pnpm, `pnpm install --frozen-lockfile`, `pnpm -w build`, makes CLI executable.

Inside the container, run `claude` for an interactive session or `claude --dangerously-skip-permissions` for unattended mode (requires non-root user — `remoteUser: node` is already set).

## 2. Cloud routines (claude.ai/code/routines)

Routines run Claude Code in Anthropic's hosted environment on a cron schedule (or one-shot). They do **not** use `.devcontainer/` — environment is configured at [claude.ai/code/routines](https://claude.ai/code/routines).

### Environment setup

In **Environment → Setup script**, paste the contents of [`/.claude/cloud-setup.sh`](../.claude/cloud-setup.sh). It installs Node 24 via nvm, pnpm 11, corepack, runs `pnpm install --frozen-lockfile`, builds packages. Cached ~7 days.

### Required environment variables

Set per-routine in **Environment → Variables**:

| Variable | Purpose | When required |
| --- | --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Long-lived Claude auth (`claude setup-token`) | All routines |
| `GH_TOKEN` | `gh` CLI auth, GitHub API | Repo writes, PR comments, gh release |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway for `releaselens check --explain` | AI explanation routines |
| `RELEASELENS_TOKEN` | Cloud API token (issued via SQL until OAuth lands) | `releaselens push` |
| `DATABASE_URL` | Neon Postgres connection string | DB read routines |
| `STRIPE_SECRET_KEY` | Stripe API | Billing reconciliation routines |
| `VERCEL_TOKEN` | Vercel API | Deploy / preview URL fetch |

### Network egress

Default routines have wide-open egress. To restrict, follow [Claude Code's reference firewall script](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh) — adapt as setup script suffix.

## 3. Example routine prompts

Each one assumes the environment above. Paste as routine prompt at [claude.ai/code/routines](https://claude.ai/code/routines).

### A. Dependency bump (cron weekly)

```
You bump pnpm dependencies that have been published >7 days ago (respects our minimumReleaseAge cooldown).

Steps:
1. Run `pnpm outdated --recursive --format json` to see candidates.
2. For each candidate, check publish date via `npm view <pkg> time`. Skip if <7 days old.
3. Bump in package.json with exact version (no ^/~ per dependency policy).
4. Run `pnpm install && pnpm -w build && pnpm -w test && pnpm -w typecheck`.
5. If green, commit subject-only: "chore: bump <pkg> to <version>". Push to a branch `chore/bump-<date>`.
6. Open a PR via `gh pr create`. Do NOT merge.
```

### B. New-issue triager

```
You triage incoming GitHub issues on vovalukashov/releaselens.

Trigger: webhook or hourly cron.

Steps:
1. `gh issue list --state open --label "needs-triage" --json number,title,body`.
2. For each issue, classify:
   - bug → label "bug" + add reproduction-request comment if missing repro.
   - feature → label "feature" + acknowledge.
   - question → label "question" + answer if from README/docs is sufficient.
   - spam → close with reason.
3. Strip "needs-triage" label after processing.
4. Report summary of N triaged.
```

## 4. Long-lived Claude Code auth token

Routines need `CLAUDE_CODE_OAUTH_TOKEN` to authenticate without browser flow. Generate:

```bash
claude setup-token
```

It prints a token starting with `sk-ant-oat...`. Paste into routine environment vars (NEVER commit).

## 5. Codespaces vs local Docker vs routine — when to use what

| Scenario | Use | Why |
| --- | --- | --- |
| Daily code work on another machine | GitHub Codespaces (uses `.devcontainer/`) | Same env everywhere, no Docker install |
| Local dev on your mac | Cursor / VS Code Dev Containers | Faster IO than Codespaces, free |
| Unattended scheduled task (dep bump, triage) | Claude Code Routine | Cron + cached env, no machine awake |
| One-shot debug / heavy compute | Routine with manual trigger | Faster CPU than local, no battery |
| Production runtime (cloud app) | Vercel | Production-grade hosting |

## 6. Gotchas

- **`postCreateCommand` runs as `node` user, but `corepack enable` needs sudo** — script uses `sudo corepack enable`.
- **Lockfile churn**: if `pnpm-lock.yaml` changes between routine runs, the cached environment is stale. Add a SessionStart hook (`.claude/settings.json`) to re-run `pnpm install` if lockfile mtime > cached.
- **Routine secrets are visible to anyone with edit access** to that routine. Use scoped tokens (per-repo, per-API).
- **Network access**: by default routines have full egress. For paranoia, copy `init-firewall.sh` from the Claude Code reference repo into the setup script suffix.
- **Volume mounts** in devcontainer.json do not work in Codespaces without `${devcontainerId}` parameterization — already configured.
- **`--dangerously-skip-permissions`** requires non-root — `remoteUser: node` is already set.

## 7. Linear MCP

`.mcp.json` at repo root declares the Linear MCP server at project scope — automatically available in routines and dev container sessions. Add more MCP servers (Vercel, Slack, etc.) by appending to the `mcpServers` field.
