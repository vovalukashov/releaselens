import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-5xl font-bold tracking-tight">ReleaseLens</h1>
      <p className="mt-4 text-xl text-zinc-400">
        Tell me what this PR breaks before it ships.
      </p>
      <p className="mt-6 text-zinc-300">
        Self-serve GitHub Action for Next.js revenue pages. SEO, forms,
        analytics, localization, and CMS checks — straight in your pull
        request comment.
      </p>

      <div className="mt-10 flex gap-4">
        <Link
          href="/pricing"
          className="rounded-lg bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400"
        >
          See pricing
        </Link>
        <a
          href="https://github.com/vovalukashov/releaselens"
          className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 hover:border-zinc-500"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>

      <section className="mt-20 grid gap-8 sm:grid-cols-2">
        <Card
          title="OSS CLI + Action"
          body="Free forever. Install in 2 minutes. Catches missing canonical, broken form submit, missing analytics events on every PR."
        />
        <Card
          title="$29/project/month Pro"
          body="Hosted PR history, cloud baselines, Slack summaries, multi-repo dashboard. One flat tier."
        />
      </section>

      <footer className="mt-20 border-t border-zinc-800 pt-6 text-sm text-zinc-500">
        Built by{' '}
        <a
          className="underline hover:text-zinc-300"
          href="https://github.com/vovalukashov"
        >
          @vovalukashov
        </a>
        .
      </footer>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </div>
  );
}
