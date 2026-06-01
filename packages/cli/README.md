# releaselens

> Tell me what this PR breaks before it ships.

`releaselens` is a self-serve, OSS pre-merge regression detector for Next.js revenue pages. On every pull request it tells you which routes, forms, analytics events, locales, or SEO tags a change can break — before the merge button.

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
- uses: vovalukashov/releaselens/actions/releaselens-check@main
```

See the [project README](https://github.com/vovalukashov/releaselens#readme) for the full config schema, the list of checks, and the FP-budget model.

## License

MIT.
