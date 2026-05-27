import { describe, expect, it } from 'vitest';
import { parseSeoMetadata } from '../src/seo/parse-metadata.js';

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
});
