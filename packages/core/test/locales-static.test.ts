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

describe('localesStaticCheck — dynamic [locale] segment (next-intl)', () => {
  it('does not emit locale-page-missing for a single [locale] page serving all locales', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app/(website)/[locale]/[slug]'), { recursive: true });
    writeFileSync(
      join(dir, 'app/(website)/[locale]/[slug]/page.tsx'),
      `export async function generateMetadata({ params }) { return { title: 'Post', alternates: { canonical: 'https://x.com' } }; }\nexport default function P() { return null; }`,
    );

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es', 'pt-br'],
      defaultLocale: 'en',
      routes: [{ id: 'post', path: '/[locale]/[slug]', locales: ['en', 'es', 'pt-br'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    expect(out.find((r) => r.issueKey === 'locale-page-missing')).toBeUndefined();
    expect(out).toHaveLength(0);
  });

  it('flags static metadata on a [locale] route (identical across locales)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app/[locale]'), { recursive: true });
    writeFileSync(
      join(dir, 'app/[locale]/page.tsx'),
      `export const metadata = { title: 'Home', description: 'D' };\nexport default function P() { return null; }`,
    );

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [{ id: 'home', path: '/[locale]', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    const finding = out.find((r) => r.issueKey === 'static-metadata-on-localized-route');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.confidence).toBe('high');
    expect(finding?.locale).toBeUndefined();
  });

  it('downgrades confidence to low when metadata is helper-wrapped', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app/[locale]'), { recursive: true });
    writeFileSync(
      join(dir, 'app/[locale]/page.tsx'),
      `export const metadata = setMetadata({ title: 'Home' });\nexport default function P() { return null; }`,
    );

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [{ id: 'home', path: '/[locale]', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    const finding = out.find((r) => r.issueKey === 'static-metadata-on-localized-route');
    expect(finding?.confidence).toBe('low');
  });

  it('emits locale-page-missing once (route-scoped) when the [locale] page is absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app'), { recursive: true });

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      routes: [{ id: 'home', path: '/[locale]', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    const missing = out.filter((r) => r.issueKey === 'locale-page-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0]?.locale).toBeUndefined();
  });

  it('honours a custom localeParam ([lang])', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rl-locales-'));
    mkdirSync(join(dir, 'app/[lang]'), { recursive: true });
    writeFileSync(
      join(dir, 'app/[lang]/page.tsx'),
      `export const metadata = { title: 'Home' };\nexport default function P() { return null; }`,
    );

    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localeParam: 'lang',
      routes: [{ id: 'home', path: '/[lang]', locales: ['en', 'es'] }],
    });
    const out = await localesStaticCheck.run({ config: cfg, cwd: dir });
    expect(out.find((r) => r.issueKey === 'static-metadata-on-localized-route')).toBeDefined();
    expect(out.find((r) => r.issueKey === 'locale-page-missing')).toBeUndefined();
  });
});
