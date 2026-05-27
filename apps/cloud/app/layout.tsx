import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReleaseLens — Pre-merge regression detector for Next.js',
  description:
    'Self-serve GitHub Action that catches form, analytics, SEO, and CMS regressions before merge.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
