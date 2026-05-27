import Link from 'next/link';

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-2 text-zinc-400">
        One flat tier. No seats. No call required.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <Plan
          name="Free"
          price="$0"
          cta="Use the OSS CLI"
          ctaHref="https://github.com/vovalukashov/releaselens"
          features={[
            'CLI + GitHub Action template',
            'All static checks (SEO, forms, analytics, localization, Payload)',
            'Markdown + JSON reports',
            'False-positive budget (baseline + dismiss)',
            'Public repos only',
          ]}
        />
        <Plan
          name="Pro"
          price="$29/project/month"
          cta="Start Pro"
          ctaHref="/api/checkout"
          highlight
          features={[
            'Everything in Free',
            'Hosted PR check history (90 days)',
            'Cloud baseline storage (shared across team)',
            'Slack summary on every PR',
            'AI explanations on critical findings',
            'Private repos supported',
          ]}
        />
      </div>

      <p className="mt-10 text-sm text-zinc-500">
        Self-serve checkout via Stripe. Cancel any time.{' '}
        <Link className="underline" href="/">
          Back to home
        </Link>
        .
      </p>
    </main>
  );
}

function Plan({
  name,
  price,
  features,
  cta,
  ctaHref,
  highlight,
}: {
  name: string;
  price: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlight
          ? 'border-blue-500/50 bg-blue-500/5'
          : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      <h2 className="text-xl font-semibold">{name}</h2>
      <p className="mt-2 text-3xl font-bold">{price}</p>
      <ul className="mt-6 space-y-2 text-sm text-zinc-300">
        {features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-8 inline-block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold ${
          highlight
            ? 'bg-blue-500 text-white hover:bg-blue-400'
            : 'border border-zinc-700 hover:border-zinc-500'
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
