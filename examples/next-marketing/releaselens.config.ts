import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  appDir: './app',
  frontendDirs: ['./app', './components'],
  previewUrl: { source: 'vercel' },
  locales: ['en'],
  defaultLocale: 'en',
  routes: [
    {
      id: 'home',
      path: '/',
      businessImpact: 'medium',
    },
    {
      id: 'pricing',
      path: '/pricing',
      businessImpact: 'high',
      cms: { collection: 'pages', slug: 'pricing' },
    },
    {
      id: 'contact-sales',
      path: '/contact-sales',
      businessImpact: 'high',
      cms: { collection: 'pages', slug: 'contact-sales' },
    },
  ],
  forms: [
    {
      id: 'pricing-lead',
      onRoute: 'pricing',
      selector: '[data-form=pricing-lead]',
      successState: { type: 'route', value: '/thank-you' },
    },
    {
      id: 'contact-sales',
      onRoute: 'contact-sales',
      selector: '[data-form=contact-sales]',
      successState: { type: 'route', value: '/thank-you' },
    },
  ],
  analytics: {
    // This demo's analytics surface is exactly its declared conversions, so we
    // opt into the reverse check: a renamed event also surfaces as undeclared.
    requireDeclared: true,
  },
  events: [
    {
      name: 'pricing_form_submit',
      onForm: 'pricing-lead',
      consent: 'analytics',
      requiredPayload: ['plan'],
    },
  ],
  adapters: {
    payload: { config: './payload.config.ts' },
  },
});
