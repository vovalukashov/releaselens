import { describe, expect, it } from 'vitest';
import { SiteDoctorConfigSchema, defineSiteDoctor } from '../src/index.js';

describe('SiteDoctorConfigSchema', () => {
  it('accepts a valid config', () => {
    const cfg = defineSiteDoctor({
      framework: 'next',
      cms: 'payload',
      hosting: 'vercel',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [
        {
          id: 'home',
          path: '/',
          requiredLocales: ['en', 'es'],
          requiredMetadata: ['title', 'description'],
        },
      ],
    });
    expect(cfg.defaultLocale).toBe('en');
    expect(cfg.routes).toHaveLength(1);
    expect(cfg.routes[0]?.type).toBe('marketing');
  });

  it('applies sensible defaults when fields are omitted', () => {
    const cfg = defineSiteDoctor({
      locales: ['en'],
      defaultLocale: 'en',
    });
    expect(cfg.framework).toBe('next');
    expect(cfg.cms).toBe('none');
    expect(cfg.hosting).toBe('vercel');
    expect(cfg.routes).toEqual([]);
  });

  it('rejects when defaultLocale is not present in locales', () => {
    expect(() =>
      SiteDoctorConfigSchema.parse({
        locales: ['en'],
        defaultLocale: 'es',
      }),
    ).toThrowError(/defaultLocale.*not present/);
  });

  it('rejects routes whose path does not start with /', () => {
    expect(() =>
      SiteDoctorConfigSchema.parse({
        locales: ['en'],
        defaultLocale: 'en',
        routes: [{ id: 'bad', path: 'pricing' }],
      }),
    ).toThrowError(/Route path must start with/);
  });

  it('rejects duplicate route ids', () => {
    expect(() =>
      SiteDoctorConfigSchema.parse({
        locales: ['en'],
        defaultLocale: 'en',
        routes: [
          { id: 'dup', path: '/a' },
          { id: 'dup', path: '/b' },
        ],
      }),
    ).toThrowError(/Duplicate route id/);
  });
});
