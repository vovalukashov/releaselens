import { defineContentOps } from '@contentops/core';

export default defineContentOps({
  framework: 'next',
  cms: 'payload',
  hosting: 'vercel',
  locales: ['en', 'es'],
  defaultLocale: 'en',
  routes: [
    {
      id: 'pricing',
      path: '/pricing',
      type: 'landing',
      cms: {
        collection: 'pages',
        slug: 'pricing',
      },
      requiredLocales: ['en', 'es'],
      requiredMetadata: ['title', 'description', 'canonical', 'hreflang'],
      analytics: {
        requiredEvents: ['page_view', 'pricing_cta_click'],
        consentSensitive: true,
      },
      experiments: {
        allowed: true,
        requiredFallback: true,
      },
    },
  ],
});
