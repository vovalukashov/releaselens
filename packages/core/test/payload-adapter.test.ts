import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPayloadModel } from '../src/adapters/payload/load-payload.js';

function writeConfig(content: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'rl-payload-'));
  const file = join(dir, 'payload.config.ts');
  writeFileSync(file, content, 'utf8');
  return { dir, file };
}

describe('loadPayloadModel', () => {
  it('extracts collections + inline blocks + localization', async () => {
    const { dir } = writeConfig(`
      export default {
        collections: [
          {
            slug: 'pages',
            fields: [
              { name: 'title', type: 'text', required: true, localized: true },
              { name: 'blocks', type: 'blocks', blocks: [
                { slug: 'Hero', fields: [{ name: 'h', type: 'text', localized: true }] },
                { slug: 'CTA', fields: [{ name: 'label', type: 'text' }] },
              ] },
            ],
          },
        ],
        localization: { locales: ['en', 'es'], defaultLocale: 'en' },
      };
    `);

    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.collections).toHaveLength(1);
    expect(model.collections[0]?.slug).toBe('pages');
    expect(model.blocks.map((b) => b.slug).sort()).toEqual(['CTA', 'Hero']);
    expect(model.blocks.every((b) => b.ownerCollection === 'pages')).toBe(true);
    expect(model.localization?.locales).toEqual(['en', 'es']);
    expect(model.localization?.defaultLocale).toBe('en');
  });

  it('supports buildConfig() wrapper from "payload"', async () => {
    const { dir } = writeConfig(`
      import { buildConfig } from 'payload';
      export default buildConfig({
        collections: [{ slug: 'items', fields: [{ name: 'name', type: 'text' }] }],
      });
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.collections[0]?.slug).toBe('items');
  });

  it('handles locale objects with code property', async () => {
    const { dir } = writeConfig(`
      export default {
        collections: [],
        localization: {
          locales: [{ code: 'en', label: 'English' }, { code: 'fr' }],
          defaultLocale: 'en',
        },
      };
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.localization?.locales).toEqual(['en', 'fr']);
  });

  it('extracts globals', async () => {
    const { dir } = writeConfig(`
      export default {
        collections: [],
        globals: [{ slug: 'settings', fields: [{ name: 'siteName', type: 'text' }] }],
      };
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.globals[0]?.slug).toBe('settings');
  });

  it('flattens nested group/row/collapsible fields', async () => {
    const { dir } = writeConfig(`
      export default {
        collections: [{
          slug: 'pages',
          fields: [
            { name: 'meta', type: 'group', fields: [
              { name: 'description', type: 'text', localized: true },
            ]},
            { type: 'row', fields: [
              { name: 'left', type: 'text' },
              { name: 'right', type: 'text' },
            ]},
          ],
        }],
      };
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    const names = model.collections[0]?.fields.map((f) => f.name).sort();
    expect(names).toEqual(['description', 'left', 'meta', 'right']);
  });

  it('stubs known payload-ecosystem imports (sharp, db adapter, richtext, storage)', async () => {
    const { dir } = writeConfig(`
      import { buildConfig } from 'payload'
      import { postgresAdapter } from '@payloadcms/db-postgres'
      import { lexicalEditor } from '@payloadcms/richtext-lexical'
      import { s3Storage } from '@payloadcms/storage-s3'
      import sharp from 'sharp'

      export default buildConfig({
        collections: [
          {
            slug: 'agencies',
            fields: [
              { name: 'name', type: 'text' },
              { name: 'website', type: 'text' },
            ],
          },
        ],
        globals: [],
        localization: { locales: ['en'], defaultLocale: 'en' },
        editor: lexicalEditor(),
        db: postgresAdapter({ pool: { connectionString: '' } }),
        sharp,
        plugins: [s3Storage({ bucket: '' })],
      })
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.collections.map((c) => c.slug)).toEqual(['agencies']);
    expect(model.localization?.locales).toEqual(['en']);
  });

  it('extracts blocks registered via lexical BlocksFeature on a richText field', async () => {
    const { dir } = writeConfig(`
      import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
      const Hero = { slug: 'hero', fields: [{ name: 'h', type: 'text' }] }
      const CTA = { slug: 'cta', fields: [{ name: 'label', type: 'text' }] }
      export default {
        collections: [
          {
            slug: 'pages',
            fields: [
              {
                name: 'content',
                type: 'richText',
                editor: lexicalEditor({ features: [BlocksFeature({ blocks: [Hero, CTA] })] }),
              },
            ],
          },
        ],
      }
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.blocks.map((b) => b.slug).sort()).toEqual(['cta', 'hero']);
    expect(model.blocks.every((b) => b.ownerCollection === 'pages')).toBe(true);
  });

  it('extracts lexical blocks when `features` is a function', async () => {
    const { dir } = writeConfig(`
      import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
      const Quote = { slug: 'quote', fields: [{ name: 'text', type: 'text' }] }
      export default {
        collections: [
          {
            slug: 'pages',
            fields: [
              {
                name: 'content',
                type: 'richText',
                editor: lexicalEditor({
                  features: ({ defaultFeatures }) => [...defaultFeatures, BlocksFeature({ blocks: [Quote] })],
                }),
              },
            ],
          },
        ],
      }
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.blocks.map((b) => b.slug)).toEqual(['quote']);
  });

  it('dedupes a block reused across multiple richText fields', async () => {
    const { dir } = writeConfig(`
      import { lexicalEditor, BlocksFeature } from '@payloadcms/richtext-lexical'
      const Shared = { slug: 'shared', fields: [{ name: 'x', type: 'text' }] }
      const editor = lexicalEditor({ features: [BlocksFeature({ blocks: [Shared] })] })
      export default {
        collections: [
          { slug: 'pages', fields: [{ name: 'a', type: 'richText', editor }] },
          { slug: 'posts', fields: [{ name: 'b', type: 'richText', editor }] },
        ],
      }
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.blocks.filter((b) => b.slug === 'shared')).toHaveLength(1);
  });

  it('bounded-retry stubs an unknown third-party plugin not in STUB_MODULES', async () => {
    const { dir } = writeConfig(`
      import { buildConfig } from 'payload'
      import { customPlugin } from '@unknown-vendor/custom-plugin'

      export default buildConfig({
        collections: [
          { slug: 'pages', fields: [{ name: 'title', type: 'text' }] },
        ],
        globals: [],
        localization: { locales: ['en'], defaultLocale: 'en' },
        plugins: [customPlugin({ enabled: true })],
      })
    `);
    const model = await loadPayloadModel('./payload.config.ts', dir);
    expect(model.collections.map((c) => c.slug)).toEqual(['pages']);
  });
});
