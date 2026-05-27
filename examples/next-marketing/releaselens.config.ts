import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  appDir: './app',
  frontendDirs: ['./app', './components'],
  previewUrl: { source: 'vercel' },
  locales: ['en', 'es'],
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
      locales: ['en', 'es'],
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
  events: [
    {
      name: 'pricing_form_submit',
      onForm: 'pricing-lead',
      consent: 'analytics',
      requiredPayload: ['plan'],
    },
    {
      name: 'contact_form_submit',
      onForm: 'contact-sales',
      consent: 'analytics',
    },
  ],
  adapters: {
    payload: { config: './payload.config.ts' },
  },
});
