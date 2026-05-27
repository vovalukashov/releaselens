import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defineReleaseLens,
  localesStaticCheck,
} from '../src/index.js';

describe('localesStaticCheck', () => {
  it('returns empty when appDir is missing', async () => {
    const cfg = defineReleaseLens({
      appDir: './does-not-exist',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [{ id: 'pricing', path: '/pricing', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: '/tmp' });
    expect(out).toHaveLength(0);
  });

  it('flags missing localized page file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app/pricing'), { recursive: true });
    writeFileSync(
      join(dir, 'app/pricing/page.tsx'),
      `export const metadata = { title: 'Pricing', alternates: { canonical: 'https://x.com/pricing' } };\nexport default function P() { return null; }`,
    );

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [{ id: 'pricing', path: '/pricing', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    expect(out.find((r) => r.locale === 'es' && r.severity === 'critical')).toBeDefined();
  });

  it('flags canonical pointing to default-locale URL on localized variant', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app/pricing'), { recursive: true });
    mkdirSync(join(dir, 'app/es/pricing'), { recursive: true });
    const sameCanonical = `export const metadata = { title: 'P', alternates: { canonical: 'https://x.com/pricing' } };\nexport default function P() { return null; }`;
    writeFileSync(join(dir, 'app/pricing/page.tsx'), sameCanonical);
    writeFileSync(join(dir, 'app/es/pricing/page.tsx'), sameCanonical);

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [{ id: 'pricing', path: '/pricing', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    expect(out.find((r) => r.message.includes('default-locale URL'))).toBeDefined();
  });
});
