# Broken-PR examples

This directory is the killer demo: it shows ReleaseLens catching the kind of
**silent revenue regressions** that normal CI, type-checking, and review let
through — the bugs that ship green and quietly cost you money for weeks.

The demo app in the parent directory is a clean baseline:

```bash
releaselens check
# All checks passed. Nothing to report.
```

Each patch below is one realistic pull request. Apply it and the tool turns red
on exactly one regression — with the diff a reviewer would have rubber-stamped.

| Patch | The "harmless" PR | What ReleaseLens catches | Who else catches it? |
| --- | --- | --- | --- |
| `01-forms.patch` | Rename a `data-form` attribute while restyling the CTA | `form-not-found` — the declared lead form no longer exists on `/pricing` | Nothing catches it pre-merge. The page still renders; the form just stopped being the lead form. |
| `02-analytics-drift.patch` | Rename the tracked event (`pricing_form_submit` → `pricing_submit`) | `event-not-tracked` for the declared event + `event-undeclared` for the new name | Nothing catches it pre-merge; runtime analytics validators see it only after deploy. |
| `03-cms-drift.patch` | Rename a Payload block slug (`PricingHero` → `PricingHeroV2`) | `payload-block-no-renderer` — the renamed block has no frontend renderer | No one until an editor adds the block and it renders blank in production. |

## Run it

```bash
# from the demo directory (examples/next-marketing)
./broken-prs/demo.sh
```

The script applies each patch, runs `releaselens check`, then reverts — so your
working tree ends up exactly where it started.

## Why this is the real test

A regression detector run on an already-shipped `HEAD` finds almost nothing —
the bugs were caught long ago. Its value only shows on the **diff that
introduces a regression**. These three PRs are exactly that: green to a human,
red to ReleaseLens.
