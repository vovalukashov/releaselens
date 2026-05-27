import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Acme — Marketing Demo', template: '%s | Acme' },
  description: 'Demo marketing site exercising releaselens checks.',
  alternates: {
    canonical: 'https://acme.example.com/',
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    <main>
      <h1>Acme</h1>
      <p>Demo marketing site for releaselens.</p>
    </main>
  );
}
