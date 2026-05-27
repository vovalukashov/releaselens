import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Acme',
  description: 'Transparent pricing for teams of any size.',
  alternates: {
    canonical: 'https://acme.example.com/pricing',
    languages: {
      en: 'https://acme.example.com/pricing',
      es: 'https://acme.example.com/es/pricing',
    },
  },
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <main>
      <h1>Pricing</h1>
      <form data-form="pricing-lead" action="/api/lead" method="post">
        <input name="email" type="email" required />
        <button type="submit">Get started</button>
      </form>
    </main>
  );
}
