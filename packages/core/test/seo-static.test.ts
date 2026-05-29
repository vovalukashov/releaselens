import { describe, expect, it } from 'vitest';
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

  it('detects generateMetadata function export', () => {
    const source = `
      export async function generateMetadata({ params }) {
        return { title: 'dynamic' };
      }
    `;
    const meta = parseSeoMetadata(source);
    expect(meta.hasMetadata).toBe(false);
    expect(meta.hasGenerateMetadata).toBe(true);
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
