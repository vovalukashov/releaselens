import { describe, expect, it } from 'vitest';
import { ReleaseLensConfigSchema, defineReleaseLens } from '../src/index.js';

describe('ReleaseLensConfigSchema', () => {
  it('accepts a minimal config', () => {
    const cfg = defineReleaseLens({
      framework: 'next',
      locales: ['en'],
      defaultLocale: 'en',
      routes: [{ id: 'pricing', path: '/pricing' }],
    });
    expect(cfg.routes).toHaveLength(1);
    expect(cfg.routes[0]?.businessImpact).toBe('medium');
    expect(cfg.previewUrl).toEqual({ source: 'vercel' });
  });

  it('applies defaults when fields are omitted', () => {
    const cfg = defineReleaseLens({});
    expect(cfg.framework).toBe('next');
    expect(cfg.locales).toEqual([]);
    expect(cfg.routes).toEqual([]);
    expect(cfg.forms).toEqual([]);
    expect(cfg.events).toEqual([]);
    expect(cfg.adapters).toEqual({});
  });

  it('rejects when defaultLocale is not present in locales', () => {
    expect(() =>
      ReleaseLensConfigSchema.parse({
        locales: ['en'],
        defaultLocale: 'es',
      }),
    ).toThrowError(/defaultLocale.*not present/);
  });

  it('rejects routes whose path does not start with /', () => {
    expect(() =>
      ReleaseLensConfigSchema.parse({
        routes: [{ id: 'bad', path: 'pricing' }],
      }),
    ).toThrowError(/Route path must start with/);
  });

  it('rejects duplicate route ids', () => {
    expect(() =>
      ReleaseLensConfigSchema.parse({
        routes: [
          { id: 'dup', path: '/a' },
          { id: 'dup', path: '/b' },
        ],
      }),
    ).toThrowError(/Duplicate route id/);
  });

  it('rejects events that specify both onForm and onRoute', () => {
    expect(() =>
      ReleaseLensConfigSchema.parse({
        events: [
          { name: 'evt', onForm: 'pricing-lead', onRoute: 'pricing' },
        ],
      }),
    ).toThrowError(/exactly one of/);
  });

  it('rejects events that specify neither onForm nor onRoute', () => {
    expect(() =>
      ReleaseLensConfigSchema.parse({
        events: [{ name: 'evt' }],
      }),
    ).toThrowError(/exactly one of/);
  });

  it('accepts a fully populated config with forms, events, rules, adapters', () => {
    const cfg = defineReleaseLens({
      framework: 'next',
      previewUrl: { source: 'vercel' },
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [
        {
          id: 'pricing',
          path: '/pricing',
          businessImpact: 'high',
          locales: ['en', 'es'],
        },
      ],
      forms: [
        {
          id: 'pricing-lead',
          onRoute: 'pricing',
          selector: '[data-form=pricing-lead]',
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
      ],
      rules: {
        'analytics.eventNotFired': {
          severity: 'critical',
          confidence: 'high',
          autoMuteAfter: 3,
        },
      },
      adapters: {
        payload: { config: './payload.config.ts' },
      },
    });
    expect(cfg.forms[0]?.id).toBe('pricing-lead');
    expect(cfg.events[0]?.consent).toBe('analytics');
    expect(cfg.adapters.payload?.config).toBe('./payload.config.ts');
  });
});
