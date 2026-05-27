import { defineReleaseLens } from '@releaselens/core';

export default defineReleaseLens({
  framework: 'next',
  appDir: './app',
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
    },
    {
      id: 'contact-sales',
      path: '/contact-sales',
      businessImpact: 'high',
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
});
