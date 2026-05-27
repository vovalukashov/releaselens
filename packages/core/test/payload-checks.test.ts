import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defineReleaseLens,
  payloadBlockRendererCheck,
  payloadLocalesConsistencyCheck,
  payloadRouteCmsEntryCheck,
} from '../src/index.js';

function setupProject(payloadConfigContent: string, componentFiles: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'rl-payload-check-'));
  writeFileSync(join(dir, 'payload.config.ts'), payloadConfigContent, 'utf8');
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'components/blocks'), { recursive: true });
  for (const [path, content] of Object.entries(componentFiles)) {
    const fullPath = join(dir, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
  return dir;
}

const PAYLOAD_HERO_AND_CTA = `
export default {
  collections: [{
    slug: 'pages',
    fields: [
      { name: 'blocks', type: 'blocks', blocks: [
        { slug: 'Hero', fields: [{ name: 'title', type: 'text' }] },
        { slug: 'CTA', fields: [{ name: 'label', type: 'text' }] },
      ]},
    ],
  }],
  localization: { locales: ['en', 'es'], defaultLocale: 'en' },
};
`;

describe('payloadBlockRendererCheck', () => {
  it('flags blocks without a matching frontend component', async () => {
    const dir = setupProject(PAYLOAD_HERO_AND_CTA, {
      'components/blocks/hero.tsx': `export function Hero() { return null; }`,
    });
    const cfg = defineReleaseLens({
      appDir: './app',
      frontendDirs: ['./app', './components'],
      adapters: { payload: { config: './payload.config.ts' } },
    });
    const out = await payloadBlockRendererCheck.run({ config: cfg, cwd: dir });
    const slugs = out.map((r) => (r.data as { block: string }).block);
    expect(slugs).toContain('CTA');
    expect(slugs).not.toContain('Hero');
  });

  it('passes when all blocks have components', async () => {
    const dir = setupProject(PAYLOAD_HERO_AND_CTA, {
      'components/blocks/hero.tsx': `export function Hero() { return null; }`,
      'components/blocks/cta.tsx': `export function CTA() { return null; }`,
    });
    const cfg = defineReleaseLens({
      appDir: './app',
      frontendDirs: ['./app', './components'],
      adapters: { payload: { config: './payload.config.ts' } },
    });
    const out = await payloadBlockRendererCheck.run({ config: cfg, cwd: dir });
    expect(out).toHaveLength(0);
  });
});

describe('payloadRouteCmsEntryCheck', () => {
  it('flags routes binding to missing collections', async () => {
    const dir = setupProject(PAYLOAD_HERO_AND_CTA);
    const cfg = defineReleaseLens({
      appDir: './app',
      adapters: { payload: { config: './payload.config.ts' } },
      routes: [
        { id: 'a', path: '/a', cms: { collection: 'pages', slug: 'a' } },
        { id: 'b', path: '/b', cms: { collection: 'unknown', slug: 'b' } },
      ],
    });
    const out = await payloadRouteCmsEntryCheck.run({ config: cfg, cwd: dir });
    expect(out).toHaveLength(1);
    expect(out[0]?.route).toBe('b');
  });
});

describe('payloadLocalesConsistencyCheck', () => {
  it('flags locale present in config but missing from Payload', async () => {
    const dir = setupProject(PAYLOAD_HERO_AND_CTA);
    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es', 'pt-br'],
      defaultLocale: 'en',
      adapters: { payload: { config: './payload.config.ts' } },
    });
    const out = await payloadLocalesConsistencyCheck.run({ config: cfg, cwd: dir });
    expect(out.find((r) => r.locale === 'pt-br' && r.severity === 'critical')).toBeDefined();
  });

  it('flags defaultLocale mismatch', async () => {
    const dir = setupProject(PAYLOAD_HERO_AND_CTA);
    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en', 'es'],
      defaultLocale: 'es',
      adapters: { payload: { config: './payload.config.ts' } },
    });
    const out = await payloadLocalesConsistencyCheck.run({ config: cfg, cwd: dir });
    expect(out.find((r) => r.message.includes('defaultLocale mismatch'))).toBeDefined();
  });

  it('returns empty when no adapter configured', async () => {
    const dir = setupProject(PAYLOAD_HERO_AND_CTA);
    const cfg = defineReleaseLens({
      appDir: './app',
      locales: ['en'],
      defaultLocale: 'en',
    });
    const out = await payloadLocalesConsistencyCheck.run({ config: cfg, cwd: dir });
    expect(out).toHaveLength(0);
  });
});
