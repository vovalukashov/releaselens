import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defineReleaseLens, seoStaticCheck } from '../src/index.js';
import { mergeSeoMetadata, parseSeoMetadata } from '../src/seo/parse-metadata.js';

describe('parseSeoMetadata', () => {
  it('extracts static title, description, canonical, hreflang, robots', () => {
    const source = `
      export const metadata = {
        title: 'Pricing',
        description: 'Pricing page description.',
        alternates: {
          canonical: 'https://example.com/pricing',
          languages: {
            en: 'https://example.com/pricing',
            es: 'https://example.com/es/pricing',
          },
        },
        robots: { index: true, follow: true },
      };
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadata).toBe(true);
    expect(meta.hasGenerateMetadata).toBe(false);
    expect(meta.title).toBe('Pricing');
    expect(meta.description).toBe('Pricing page description.');
    expect(meta.canonical).toBe('https://example.com/pricing');
    expect(meta.hreflang).toEqual({
      en: 'https://example.com/pricing',
      es: 'https://example.com/es/pricing',
    });
    expect(meta.robotsIndex).toBe(true);
  });

  it('handles title as { default, template }', () => {
    const source = `
      export const metadata = {
        title: { default: 'Home', template: '%s | Site' },
      };
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.title).toBe('Home');
  });

  it('detects noindex from string robots', () => {
    const source = `
      export const metadata = {
        title: 'X',
        robots: 'noindex, nofollow',
      };
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.robotsIndex).toBe(false);
  });

  it('detects generateMetadata and extracts its returned literal', () => {
    const source = `
      export async function generateMetadata({ params }) {
        return { title: 'dynamic', description: 'd' };
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasGenerateMetadata).toBe(true);
    expect(meta.hasMetadata).toBe(true);
    expect(meta.hasTitle).toBe(true);
    expect(meta.title).toBe('dynamic');
    expect(meta.hasDescription).toBe(true);
  });

  it('returns empty when neither metadata nor generateMetadata exported', () => {
    const source = `
      export default function Page() {
        return null;
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadata).toBe(false);
    expect(meta.hasGenerateMetadata).toBe(false);
    expect(meta.title).toBeUndefined();
  });

  it('skips dynamic expressions (variable refs)', () => {
    const source = `
      const TITLE = 'Computed';
      export const metadata = {
        title: TITLE,
        description: 'static',
      };
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadata).toBe(true);
    expect(meta.title).toBeUndefined();
    expect(meta.description).toBe('static');
  });

  it('marks fields present even when values are non-literal (siteConfig pattern)', () => {
    const source = `
      export const metadata = {
        title: { default: siteConfig.name, template: '%s | ' + siteConfig.name },
        description: siteConfig.description,
        alternates: { canonical: siteConfig.url, languages: someLanguages },
      };
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasTitle).toBe(true);
    expect(meta.hasDescription).toBe(true);
    expect(meta.hasCanonical).toBe(true);
    expect(meta.hasHreflang).toBe(true);
    expect(meta.title).toBeUndefined();
  });
});

describe('helper-wrapped generateMetadata', () => {
  it('extracts fields from `return setMetadata({...})`', () => {
    const source = `
      import { setMetadata } from '@lib/utils';
      export async function generateMetadata() {
        return setMetadata({
          title: 'Pricing',
          description: 'Plans and pricing',
          canonical: 'https://example.com/pricing',
          languages: { en: 'https://example.com/pricing', es: 'https://example.com/es/pricing' },
        });
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasGenerateMetadata).toBe(true);
    expect(meta.hasMetadata).toBe(true);
    expect(meta.hasTitle).toBe(true);
    expect(meta.title).toBe('Pricing');
    expect(meta.hasDescription).toBe(true);
    expect(meta.hasCanonical).toBe(true);
    expect(meta.canonical).toBe('https://example.com/pricing');
    expect(meta.hasHreflang).toBe(true);
    expect(meta.hreflang?.es).toBe('https://example.com/es/pricing');
  });

  it('works with any wrapper name (constructMetadata)', () => {
    const source = `
      export const generateMetadata = async () => constructMetadata({ title: 'X' });
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasGenerateMetadata).toBe(true);
    expect(meta.hasMetadata).toBe(true);
    expect(meta.hasTitle).toBe(true);
    expect(meta.title).toBe('X');
  });

  it('resolves a variable returned from generateMetadata', () => {
    const source = `
      export async function generateMetadata() {
        const m = { title: 'A', description: 'B' };
        return m;
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasTitle).toBe(true);
    expect(meta.title).toBe('A');
    expect(meta.hasDescription).toBe(true);
  });

  it('handles `export const metadata = setMetadata({...})` (static helper-wrapped)', () => {
    const source = `
      export const metadata = setMetadata({ title: 'Home', description: 'D' });
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadata).toBe(true);
    expect(meta.hasTitle).toBe(true);
    expect(meta.hasDescription).toBe(true);
  });

  it('flags a spread in the metadata object via hasMetadataSpread', () => {
    const source = `
      export async function generateMetadata() {
        return setMetadata({
          title: 'T',
          ...getLocaleMetadata(host, path, 'en'),
        });
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasTitle).toBe(true);
    expect(meta.hasCanonical).toBe(false);
    expect(meta.hasMetadataSpread).toBe(true);
  });

  it('recognises shorthand-property keys (`{ canonical }`, `{ title, description }`)', () => {
    const source = `
      const canonical = '...';
      const title = '...';
      export async function generateMetadata() {
        return setMetadata({ canonical, title });
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasCanonical).toBe(true);
    expect(meta.hasTitle).toBe(true);
    expect(meta.hasDescription).toBe(false);
  });

  it('flags helper-wrap with hasMetadataHelperWrap so missing fields can be downgraded', () => {
    const source = `
      const canonical = '...';
      export async function generateMetadata() {
        return setMetadata({ canonical });
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadataHelperWrap).toBe(true);
    expect(meta.hasCanonical).toBe(true);
    expect(meta.hasTitle).toBe(false);
  });

  it('does not set hasMetadataHelperWrap on a plain object literal', () => {
    const source = `export const metadata = { title: 'x' };`;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadataHelperWrap).toBe(false);
  });

  it('sets hasMetadataHelperWrap on `export const metadata = helperCall({...})`', () => {
    const source = `export const metadata = setMetadata({ title: 'x' });`;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadataHelperWrap).toBe(true);
  });

  it('recognises shorthand `alternates: { canonical }`', () => {
    const source = `
      const canonical = '...';
      export const metadata = { alternates: { canonical } };
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasCanonical).toBe(true);
  });

  it('reads noIndex: true as robotsIndex=false', () => {
    const source = `
      export const metadata = setMetadata({ title: 'X', noIndex: true });
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.robotsIndex).toBe(false);
  });
});

describe('seoStaticCheck — confidence on dynamic metadata', () => {
  function writePage(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'rl-seo-'));
    mkdirSync(join(dir, 'app/post'), { recursive: true });
    writeFileSync(join(dir, 'app/post/page.tsx'), content);
    return dir;
  }

  it('downgrades missing-field findings to low confidence for generateMetadata', async () => {
    const dir = writePage(
      `export async function generateMetadata({ params }) { if (!params) return {}; return { title: 'Post' }; }\nexport default function P() { return null; }`,
    );
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'post', path: '/post', businessImpact: 'high' }],
    });
    const out = await seoStaticCheck.run({ config: cfg, cwd: dir });
    const desc = out.find((r) => r.issueKey === 'missing-description');
    const canonical = out.find((r) => r.issueKey === 'missing-canonical');
    expect(desc?.confidence).toBe('low');
    expect(canonical?.confidence).toBe('low');
    expect(out.find((r) => r.issueKey === 'missing-title')).toBeUndefined();
  });

  it('keeps high confidence for static metadata missing a field', async () => {
    const dir = writePage(
      `export const metadata = { title: 'Post' };\nexport default function P() { return null; }`,
    );
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'post', path: '/post', businessImpact: 'high' }],
    });
    const out = await seoStaticCheck.run({ config: cfg, cwd: dir });
    const desc = out.find((r) => r.issueKey === 'missing-description');
    expect(desc?.confidence).toBe('high');
  });
});

describe('mergeSeoMetadata', () => {
  it('inherits layout metadata into a page that defines none', () => {
    const layout = parseSeoMetadata(`
      export const metadata = {
        title: { default: siteConfig.name, template: '%s' },
        description: siteConfig.description,
      };
    `);
    const page = parseSeoMetadata(`export default function Page() { return null; }`);
    const merged = mergeSeoMetadata([layout, page]);
    expect(merged.hasMetadata).toBe(true);
    expect(merged.hasTitle).toBe(true);
    expect(merged.hasDescription).toBe(true);
  });

  it('lets the page override layout literal values', () => {
    const layout = parseSeoMetadata(`export const metadata = { title: 'Layout' };`);
    const page = parseSeoMetadata(`export const metadata = { title: 'Page' };`);
    expect(mergeSeoMetadata([layout, page]).title).toBe('Page');
  });
});
