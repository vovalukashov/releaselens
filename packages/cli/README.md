# releaselens

> Pre-merge contract diff for Next.js App Router marketing sites — before merge, not after deploy.

`releaselens` is a self-serve, OSS pre-merge contract checker for Next.js App Router marketing sites. On every pull request it diffs the contracts your revenue pages depend on — SEO metadata, locale coverage, and Payload CMS block↔renderer wiring — plus experimental forms/analytics tripwires, and tells you what a change breaks before the merge button.

## Quickstart

```bash
npm i -D releaselens
npx releaselens init     # scaffold releaselens.config.ts
npx releaselens check    # run checks and print a report
```

| Flag | Effect |
| --- | --- |
| `--ci` | Exit non-zero on blocking critical findings. |
| `--json` | Machine-readable output. |
| `--report` | Also write `releaselens-report.md` (for PR artifacts). |
| `--update-baseline` | Snapshot current findings to `.releaselens/baseline.json`. |
| `--explain` | Add AI explanations to findings (needs `AI_GATEWAY_API_KEY`). |

## GitHub Action

```yaml
- uses: actions/checkout@v6
- uses: actions/setup-node@v6
  with:
    node-version: '20'
- uses: vovalukashov/releaselens/actions/releaselens-check@v0.1.3
```

See the [project README](https://github.com/vovalukashov/releaselens#readme) for the full config schema, the list of checks, and the FP-budget model.

## License

MIT.
