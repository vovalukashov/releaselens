# @releaselens/cloud

Hosted backend for ReleaseLens. Stores PR check history, cloud baselines, Slack notifications, Stripe billing.

## Stack

- Next.js 16 (App Router) on Vercel
- Neon Postgres via Vercel Marketplace integration
- Drizzle ORM
- Stripe for billing
- Slack incoming webhooks for notifications
- (Month 7) GitHub OAuth via Auth.js

## Deploy on Vercel

1. **Create Vercel project** linked to `apps/cloud` as Root Directory.
2. **Add Neon Postgres** from Vercel Marketplace → auto-provisions `DATABASE_URL` env var.
3. **Set env vars** (Production + Preview):
   - `DATABASE_URL` — Neon connection string (auto-set by integration).
   - `STRIPE_SECRET_KEY` — `sk_live_...` (or `sk_test_...` for testing).
   - `STRIPE_PRICE_ID` — Stripe Price object for $29/project/month subscription.
   - `STRIPE_WEBHOOK_SECRET` — `whsec_...` from Stripe webhook endpoint.
   - `NEXT_PUBLIC_APP_URL` — `https://releaselens.vercel.app` or custom domain.
4. **Run migrations** locally against prod DB:
   ```bash
   pnpm --filter @releaselens/cloud db:push
   ```
5. **Configure Stripe webhook** endpoint at `https://your-domain/api/webhook/stripe` for events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

## API

All endpoints (except `/api/checkout` GET) require `Authorization: Bearer <api_token>` header.

### `POST /api/reports`
Upload a PR check report.
```json
{
  "report": { "passed": false, "counts": {...}, "results": [...] },
  "prNumber": "42",
  "branch": "feat/pricing",
  "commit": "abc123"
}
```

### `GET /api/reports?limit=25`
List recent reports for the authenticated project.

### `POST /api/baselines`
Replace baseline fingerprints.
```json
{ "fingerprints": ["abc123", "def456"] }
```

### `GET /api/baselines`
Fetch current baseline.

### `GET /api/checkout`
Redirects to Stripe Checkout for Pro subscription.

### `POST /api/webhook/stripe`
Stripe webhook receiver (signature-verified).

## Local dev

```bash
cp apps/cloud/.env.example apps/cloud/.env.local
# fill in DATABASE_URL (e.g. local Postgres)
pnpm --filter @releaselens/cloud db:push
pnpm --filter @releaselens/cloud dev
```

## API token issuance (Month 6 manual)

Until OAuth dashboard lands, tokens are issued manually via SQL:

```sql
INSERT INTO users (github_id, email, name)
VALUES ('vovalukashov', 'you@example.com', 'Vova')
RETURNING id;

INSERT INTO projects (user_id, slug, api_token)
VALUES (
  '<user-id-from-above>',
  'vovalukashov/my-repo',
  'rl_' || encode(gen_random_bytes(24), 'hex')
)
RETURNING api_token;
```

Use the returned token as `RELEASELENS_TOKEN` env var in the GitHub Action.

## Roadmap

- Month 6 (now): backend skeleton + reports/baselines API + Stripe checkout stub.
- Month 7+: GitHub OAuth + self-serve project provisioning + Stripe subscription linkage + dashboard UI.
