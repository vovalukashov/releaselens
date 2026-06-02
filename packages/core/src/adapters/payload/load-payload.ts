import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createJiti } from 'jiti';
import type {
  BlockModel,
  CollectionModel,
  ContentModel,
  FieldModel,
  GlobalModel,
  LocalizationModel,
} from '../../content/content-model.js';

// Each aliased module gets the same stub. The exported value is a recursive
// Proxy: any property access (including unknown named imports like custom
// plugin functions) returns another callable proxy. This way the stub covers
// `import sharp from 'sharp'`, `import { buildConfig } from 'payload'`,
// `import { access } from '@acme/payload'`, and any project-specific
// plugin name we cannot predict, all from a single file.
//
// The stub is CJS so the transpiled `require('…').X` destructuring hits the
// Proxy at runtime — an ESM static-export stub cannot do that.
const PAYLOAD_STUB = `
"use strict";
const identity = (x) => x;
// Regular function (not arrow) so the Proxy target is both callable AND
// constructible — covers \`new SomeSdk()\` patterns in plugin code.
const constructibleNoop = function noop() {};
const makeProxy = (target) => new Proxy(target || constructibleNoop, {
  get(t, prop, receiver) {
    if (prop === 'then') return undefined;
    if (typeof prop === 'symbol') return Reflect.get(t, prop, receiver);
    if (Object.prototype.hasOwnProperty.call(t, prop)) {
      return Reflect.get(t, prop, receiver);
    }
    if (prop === '__esModule') return true;
    return makeProxy();
  },
  // jiti's CJS-interop checks \`__esModule\` via \`in\` and via property
  // descriptor lookup, not just plain get — answer truthfully on both.
  has(t, prop) {
    if (prop === '__esModule') return true;
    if (Object.prototype.hasOwnProperty.call(t, prop)) return true;
    return true;
  },
  getOwnPropertyDescriptor(t, prop) {
    const own = Object.getOwnPropertyDescriptor(t, prop);
    if (own) return own;
    return { configurable: true, enumerable: true, value: makeProxy(), writable: true };
  },
  apply() { return makeProxy(); },
  construct() { return makeProxy(); },
});
const target = function () {};
target.__esModule = true;
target.buildConfig = identity;
target.default = identity;
module.exports = makeProxy(target);
`;

// Specialized stub for the lexical rich-text editor. The generic stub discards
// call arguments, which loses the blocks registered via
// `lexicalEditor({ features: [BlocksFeature({ blocks: [...] })] })` — the
// idiomatic way modern Payload sites attach blocks. This stub preserves just
// enough structure (features → blocks) for the model walker to find them, while
// every other lexical export stays a noop proxy.
const LEXICAL_STUB = `
"use strict";
const makeProxy = (target) => new Proxy(target || function () {}, {
  get(t, prop, receiver) {
    if (prop === 'then') return undefined;
    if (typeof prop === 'symbol') return Reflect.get(t, prop, receiver);
    if (Object.prototype.hasOwnProperty.call(t, prop)) return Reflect.get(t, prop, receiver);
    if (prop === '__esModule') return true;
    return makeProxy();
  },
  has(t, prop) { return true; },
  getOwnPropertyDescriptor(t, prop) {
    const own = Object.getOwnPropertyDescriptor(t, prop);
    if (own) return own;
    return { configurable: true, enumerable: true, value: makeProxy(), writable: true };
  },
  apply() { return makeProxy(); },
  construct() { return makeProxy(); },
});
function lexicalEditor(cfg) {
  let features = (cfg && cfg.features) || [];
  if (typeof features === 'function') {
    try { features = features({ rootFeatures: [], defaultFeatures: [] }) || []; }
    catch (e) { features = []; }
  }
  return { features: Array.isArray(features) ? features : [] };
}
function BlocksFeature(cfg) {
  return {
    blocks: (cfg && cfg.blocks) || [],
    inlineBlocks: (cfg && cfg.inlineBlocks) || [],
  };
}
const base = function () {};
base.__esModule = true;
base.lexicalEditor = lexicalEditor;
base.BlocksFeature = BlocksFeature;
base.default = lexicalEditor;
module.exports = makeProxy(base);
`;

const LEXICAL_MODULE = '@payloadcms/richtext-lexical';

const STUB_MODULES = [
  'sharp',
  'payload',
  '@payloadcms/db-postgres',
  '@payloadcms/db-mongodb',
  '@payloadcms/db-sqlite',
  '@payloadcms/db-vercel-postgres',
  '@payloadcms/richtext-lexical',
  '@payloadcms/richtext-slate',
  '@payloadcms/storage-s3',
  '@payloadcms/storage-vercel-blob',
  '@payloadcms/storage-uploadthing',
  '@payloadcms/storage-azure',
  '@payloadcms/storage-gcs',
  '@payloadcms/next',
  '@payloadcms/ui',
  '@payloadcms/email-resend',
  '@payloadcms/email-nodemailer',
  '@payloadcms/plugin-cloud',
  '@payloadcms/plugin-search',
  '@payloadcms/plugin-seo',
  '@payloadcms/plugin-form-builder',
  '@payloadcms/plugin-redirects',
  '@payloadcms/plugin-stripe',
  '@payloadcms/plugin-multi-tenant',
  '@payloadcms/plugin-sentry',
  '@payloadcms/plugin-import-export',
  '@payloadcms/plugin-nested-docs',
];

interface RawPayloadConfig {
  collections?: unknown[];
  globals?: unknown[];
  blocks?: unknown[];
  localization?: {
    locales?: unknown[];
    defaultLocale?: string;
  };
}

export async function loadPayloadModel(
  configPath: string,
  cwd: string,
): Promise<ContentModel> {
  const absPath = resolve(cwd, configPath);
  const stubDir = join(
    tmpdir(),
    `releaselens-payload-stub-${process.pid}-${Date.now()}`,
  );
  mkdirSync(stubDir, { recursive: true });
  const stubFile = join(stubDir, 'payload-stub.cjs');
  writeFileSync(stubFile, PAYLOAD_STUB, 'utf8');
  const lexicalStubFile = join(stubDir, 'lexical-stub.cjs');
  writeFileSync(lexicalStubFile, LEXICAL_STUB, 'utf8');

  const alias: Record<string, string> = {};
  for (const name of STUB_MODULES) alias[name] = stubFile;
  // Pre-scan the config + its relative dep graph for external specifiers
  // (including sub-paths like `@payloadcms/storage-s3/utilities`) and stub
  // each one exactly, side-stepping jiti's prefix-concat alias behaviour.
  for (const spec of collectExternalSpecifiers(absPath)) {
    alias[spec] = stubFile;
  }
  // The lexical editor needs the structure-preserving stub so block
  // registrations survive — override any generic alias set above.
  alias[LEXICAL_MODULE] = lexicalStubFile;

  try {
    // Bounded retry: each iteration tries to load the config; if the failure
    // is "Cannot find module 'X'", X is added to the stub alias and we retry.
    // This catches workspace packages and obscure plugins without requiring
    // every consumer to be hand-listed in STUB_MODULES.
    const MAX_RETRIES = 30;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const jiti = createJiti(absPath, { interopDefault: true, alias });
        const raw = (await jiti.import(absPath, { default: true })) as
          | RawPayloadConfig
          | undefined;
        if (!raw || typeof raw !== 'object') {
          throw new Error(
            `Payload config at ${absPath} did not export a config object as default.`,
          );
        }
        return normalizePayloadConfig(raw);
      } catch (err) {
        const missing = extractMissingModule(err);
        if (!missing || alias[missing] !== undefined || isRelative(missing)) {
          throw err;
        }
        alias[missing] = stubFile;
      }
    }
    throw new Error(
      `Payload config at ${absPath} could not be loaded after ${MAX_RETRIES} stub-extension retries.`,
    );
  } finally {
    rmSync(stubDir, { recursive: true, force: true });
  }
}

const SCAN_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js'];
const NODE_BUILTINS = new Set([
  'fs', 'fs/promises', 'path', 'os', 'url', 'crypto', 'stream', 'util', 'events',
  'http', 'https', 'net', 'tls', 'zlib', 'child_process', 'worker_threads',
  'buffer', 'querystring', 'string_decoder', 'timers', 'console', 'process',
  'module', 'assert', 'cluster', 'dns', 'tty', 'vm', 'v8', 'readline', 'perf_hooks',
  'node:fs', 'node:path', 'node:os', 'node:url', 'node:crypto', 'node:stream',
  'node:util', 'node:events', 'node:buffer', 'node:process', 'node:module',
]);

function collectExternalSpecifiers(entry: string): Set<string> {
  const result = new Set<string>();
  const visited = new Set<string>();
  walk(entry);
  return result;

  function walk(file: string): void {
    if (visited.has(file) || !existsSync(file)) return;
    visited.add(file);
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch {
      return;
    }
    const re = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      const spec = (m[1] ?? m[2] ?? '').trim();
      if (!spec) continue;
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const baseDir = dirname(file);
        const target = resolveRelative(baseDir, spec);
        if (target) walk(target);
      } else if (!NODE_BUILTINS.has(spec) && !spec.startsWith('node:')) {
        result.add(spec);
      }
    }
  }
}

function resolveRelative(baseDir: string, spec: string): string | undefined {
  const base = resolve(baseDir, spec);
  for (const ext of SCAN_EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of SCAN_EXTENSIONS) {
    const candidate = join(base, 'index' + ext);
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(base)) return base;
  return undefined;
}

function extractMissingModule(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const match = err.message.match(/Cannot find module ['"]([^'"]+)['"]/);
  return match?.[1];
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

function normalizePayloadConfig(raw: RawPayloadConfig): ContentModel {
  const collections: CollectionModel[] = [];
  const inlineBlocks: BlockModel[] = [];

  for (const item of raw.collections ?? []) {
    const collection = normalizeCollection(item);
    if (!collection) continue;
    collections.push(collection.model);
    inlineBlocks.push(...collection.blocks);
  }

  const globals: GlobalModel[] = [];
  for (const item of raw.globals ?? []) {
    const g = normalizeGlobal(item);
    if (g) globals.push(g);
  }

  const topLevelBlocks: BlockModel[] = [];
  for (const item of raw.blocks ?? []) {
    const norm = normalizeBlock(item, 'top-level');
    if (norm) topLevelBlocks.push(norm.block, ...norm.nested);
  }

  const result: ContentModel = {
    collections,
    globals,
    blocks: dedupeBlocks([...topLevelBlocks, ...inlineBlocks]),
  };

  const localization = normalizeLocalization(raw.localization);
  if (localization) {
    result.localization = localization;
  }

  return result;
}

function dedupeBlocks(blocks: BlockModel[]): BlockModel[] {
  const seen = new Set<string>();
  const out: BlockModel[] = [];
  for (const block of blocks) {
    if (seen.has(block.slug)) continue;
    seen.add(block.slug);
    out.push(block);
  }
  return out;
}

function normalizeCollection(
  raw: unknown,
): { model: CollectionModel; blocks: BlockModel[] } | undefined {
  if (!isObject(raw)) return undefined;
  const slug = readString(raw, 'slug');
  if (!slug) return undefined;
  const fieldsRaw = Array.isArray(raw.fields) ? raw.fields : [];
  const { fields, blocks } = walkFields(fieldsRaw, slug);
  return {
    model: {
      slug,
      fields,
      versions: Boolean(raw.versions),
      draftEnabled: Boolean(
        isObject(raw.versions) && raw.versions.drafts,
      ),
    },
    blocks,
  };
}

function normalizeGlobal(raw: unknown): GlobalModel | undefined {
  if (!isObject(raw)) return undefined;
  const slug = readString(raw, 'slug');
  if (!slug) return undefined;
  const fieldsRaw = Array.isArray(raw.fields) ? raw.fields : [];
  const { fields } = walkFields(fieldsRaw, slug);
  return { slug, fields };
}

function normalizeBlock(
  raw: unknown,
  source: 'top-level' | 'inline',
  owner?: string,
): { block: BlockModel; nested: BlockModel[] } | undefined {
  if (!isObject(raw)) return undefined;
  const slug = readString(raw, 'slug');
  if (!slug) return undefined;
  const fieldsRaw = Array.isArray(raw.fields) ? raw.fields : [];
  const { fields, blocks: nested } = walkFields(fieldsRaw, slug);
  const block: BlockModel = { slug, fields, source };
  if (owner) block.ownerCollection = owner;
  return { block, nested };
}

/** Blocks registered on a rich-text field via `lexicalEditor({ features: [BlocksFeature({ blocks })] })`. */
function lexicalBlocks(editor: Record<string, unknown>): unknown[] {
  const features = Array.isArray(editor.features) ? editor.features : [];
  const out: unknown[] = [];
  for (const feature of features) {
    if (!isObject(feature)) continue;
    if (Array.isArray(feature.blocks)) out.push(...feature.blocks);
    if (Array.isArray(feature.inlineBlocks)) out.push(...feature.inlineBlocks);
  }
  return out;
}

function walkFields(
  rawFields: unknown[],
  ownerSlug: string,
): { fields: FieldModel[]; blocks: BlockModel[] } {
  const fields: FieldModel[] = [];
  const blocks: BlockModel[] = [];

  for (const raw of rawFields) {
    if (!isObject(raw)) continue;
    const name = readString(raw, 'name');
    const type = readString(raw, 'type') ?? 'unknown';
    if (name) {
      fields.push({
        name,
        type,
        required: Boolean(raw.required),
        localized: Boolean(raw.localized),
      });
    }
    if (type === 'blocks' && Array.isArray(raw.blocks)) {
      for (const b of raw.blocks) {
        const norm = normalizeBlock(b, 'inline', ownerSlug);
        if (norm) blocks.push(norm.block, ...norm.nested);
      }
    }
    if (type === 'richText' && isObject(raw.editor)) {
      for (const b of lexicalBlocks(raw.editor)) {
        const norm = normalizeBlock(b, 'inline', ownerSlug);
        if (norm) blocks.push(norm.block, ...norm.nested);
      }
    }
    if (type === 'group' && Array.isArray(raw.fields)) {
      const nested = walkFields(raw.fields, ownerSlug);
      fields.push(...nested.fields);
      blocks.push(...nested.blocks);
    }
    if (type === 'array' && Array.isArray(raw.fields)) {
      const nested = walkFields(raw.fields, ownerSlug);
      blocks.push(...nested.blocks);
    }
    if (
      (type === 'row' || type === 'collapsible') &&
      Array.isArray(raw.fields)
    ) {
      const nested = walkFields(raw.fields, ownerSlug);
      fields.push(...nested.fields);
      blocks.push(...nested.blocks);
    }
    if (type === 'tabs' && Array.isArray(raw.tabs)) {
      for (const tab of raw.tabs) {
        if (isObject(tab) && Array.isArray(tab.fields)) {
          const nested = walkFields(tab.fields, ownerSlug);
          fields.push(...nested.fields);
          blocks.push(...nested.blocks);
        }
      }
    }
  }

  return { fields, blocks };
}

function normalizeLocalization(
  raw: RawPayloadConfig['localization'],
): LocalizationModel | undefined {
  if (!raw) return undefined;
  const locales: string[] = [];
  for (const l of raw.locales ?? []) {
    if (typeof l === 'string') locales.push(l);
    else if (isObject(l) && typeof l.code === 'string') locales.push(l.code);
  }
  const model: LocalizationModel = { locales };
  if (typeof raw.defaultLocale === 'string') {
    model.defaultLocale = raw.defaultLocale;
  }
  return model;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function readString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}
