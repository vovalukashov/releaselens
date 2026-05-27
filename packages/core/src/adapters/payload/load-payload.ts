import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJiti } from 'jiti';
import type {
  BlockModel,
  CollectionModel,
  ContentModel,
  FieldModel,
  GlobalModel,
  LocalizationModel,
} from '../../content/content-model.js';

const PAYLOAD_STUB = `
const identity = (config) => config;
export const buildConfig = identity;
export const postgresAdapter = () => ({});
export const mongooseAdapter = () => ({});
export const sqliteAdapter = () => ({});
export const slateEditor = () => ({});
export const lexicalEditor = () => ({});
export default { buildConfig: identity };
`;

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
  const stubFile = join(stubDir, 'payload.mjs');
  writeFileSync(stubFile, PAYLOAD_STUB, 'utf8');

  try {
    const jiti = createJiti(absPath, {
      interopDefault: true,
      alias: {
        payload: stubFile,
        '@payloadcms/db-postgres': stubFile,
        '@payloadcms/db-mongodb': stubFile,
        '@payloadcms/db-sqlite': stubFile,
        '@payloadcms/richtext-lexical': stubFile,
        '@payloadcms/richtext-slate': stubFile,
      },
    });
    const raw = (await jiti.import(absPath, { default: true })) as
      | RawPayloadConfig
      | undefined;
    if (!raw || typeof raw !== 'object') {
      throw new Error(
        `Payload config at ${absPath} did not export a config object as default.`,
      );
    }
    return normalizePayloadConfig(raw);
  } finally {
    rmSync(stubDir, { recursive: true, force: true });
  }
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
    const block = normalizeBlock(item, 'top-level');
    if (block) topLevelBlocks.push(block);
  }

  const result: ContentModel = {
    collections,
    globals,
    blocks: [...topLevelBlocks, ...inlineBlocks],
  };

  const localization = normalizeLocalization(raw.localization);
  if (localization) {
    result.localization = localization;
  }

  return result;
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
): BlockModel | undefined {
  if (!isObject(raw)) return undefined;
  const slug = readString(raw, 'slug');
  if (!slug) return undefined;
  const fieldsRaw = Array.isArray(raw.fields) ? raw.fields : [];
  const { fields } = walkFields(fieldsRaw, slug);
  const block: BlockModel = { slug, fields, source };
  if (owner) block.ownerCollection = owner;
  return block;
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
        const block = normalizeBlock(b, 'inline', ownerSlug);
        if (block) blocks.push(block);
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
