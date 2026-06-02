import type { Metadata } from 'next';
import { PricingForm } from './pricing-form';

export const metadata: Metadata = {
  title: 'Pricing — Acme',
  description: 'Transparent pricing for teams of any size.',
  alternates: {
    canonical: 'https://acme.example.com/pricing',
  },
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return (
    <main>
      <h1>Pricing</h1>
      <PricingForm />
    </main>
  );
}
