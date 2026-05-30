# Claude Code Routines

Run ReleaseLens maintenance tasks unattended via [Claude Code routines](https://claude.ai/code/routines) — cron-scheduled (or one-shot) jobs that execute in Anthropic's hosted environment.

## 1. Environment setup

In **Environment → Setup script** at [claude.ai/code/routines](https://claude.ai/code/routines), paste the contents of [`/.claude/cloud-setup.sh`](../.claude/cloud-setup.sh). It installs Node 24 via nvm, pnpm 11, corepack, runs `pnpm install --frozen-lockfile`, builds packages. Cached ~7 days.

## 2. Required environment variables

Set per-routine in **Environment → Variables**:

| Variable | Purpose | When required |
| --- | --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | Long-lived Claude auth (`claude setup-token`) | All routines |
| `GH_TOKEN` | `gh` CLI auth, GitHub API | Repo writes, PR comments, releases |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway for `releaselens check --explain` | AI explanation routines |
| `RELEASELENS_TOKEN` | Cloud API token (issued via SQL until OAuth lands) | `releaselens push` |
| `DATABASE_URL` | Neon Postgres connection string | DB read routines |
| `STRIPE_SECRET_KEY` | Stripe API | Billing reconciliation routines |
| `VERCEL_TOKEN` | Vercel API | Deploy / preview URL fetch |

### Network egress

Default routines have wide-open egress. To restrict, follow [Claude Code's reference firewall script](https://github.com/anthropics/claude-code/blob/main/.devcontainer/init-firewall.sh) — adapt as a setup script suffix.

## 3. Example routine prompts

Each one assumes the environment above.

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
   - question → label "question" + answer if README/docs is sufficient.
   - spam → close with reason.
3. Strip "needs-triage" label after processing.
4. Report summary of N triaged.
```

## 4. Long-lived auth token

Routines need `CLAUDE_CODE_OAUTH_TOKEN` to authenticate without browser flow. Generate:

```bash
claude setup-token
```

It prints a token starting with `sk-ant-oat...`. Paste into routine environment vars (NEVER commit).

## 5. Linear MCP

`.mcp.json` at repo root declares the Linear MCP server at project scope — automatically available in routine sessions. Add more MCP servers (Vercel, Slack, etc.) by appending to the `mcpServers` field.
