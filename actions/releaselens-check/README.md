# ReleaseLens Check Action

Run `releaselens check` against your Next.js repository on every pull request. Posts a markdown comment with findings, uploads the report as an artifact, and fails the workflow when there are blocking critical findings.

## Usage

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
      - run: corepack enable
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - uses: vovalukashov/releaselens/actions/releaselens-check@main
        with:
          working-directory: '.'
```

## Inputs

| Name | Default | Description |
| --- | --- | --- |
| `working-directory` | `.` | Directory containing `releaselens.config.{ts,mjs,js}`. |
| `config` | _(auto-discovery)_ | Explicit path to the config file (relative to `working-directory`). |
| `ci` | `true` | Exit non-zero when blocking critical findings are present. |
| `pr-comment` | `true` | Post a PR comment with the markdown report. |
| `github-token` | `${{ github.token }}` | Token used to post the PR comment. |

## Notes

- The action expects `releaselens` to be available as a workspace binary (`pnpm exec releaselens`).
- Findings already captured in `.releaselens/baseline.json` are filtered automatically.
- Findings dismissed via `releaselens dismiss <fingerprint>` are filtered automatically.
- Low-confidence critical findings do not block the workflow even when `ci: true`.
