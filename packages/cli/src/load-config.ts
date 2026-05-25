import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { createJiti } from 'jiti';
import {
  ContentOpsConfigSchema,
  type ContentOpsConfig,
} from '@contentops/core';

const CONFIG_NAMES = [
  'contentops.config.ts',
  'contentops.config.mjs',
  'contentops.config.js',
] as const;

export interface LoadConfigOptions {
  cwd?: string;
  explicit?: string;
}

export interface LoadedConfig {
  config: ContentOpsConfig;
  path: string;
}

export class ConfigNotFoundError extends Error {
  constructor(public readonly cwd: string) {
    super(
      `No contentops.config.{ts,mjs,js} found starting from ${cwd}. Run "contentops init" to scaffold one.`,
    );
    this.name = 'ConfigNotFoundError';
  }
}

export async function loadConfig(
  opts: LoadConfigOptions = {},
): Promise<LoadedConfig> {
  const cwd = opts.cwd ?? process.cwd();
  const filePath = opts.explicit
    ? resolveExplicit(opts.explicit, cwd)
    : findConfigUpwards(cwd);

  if (!filePath) {
    throw new ConfigNotFoundError(cwd);
  }

  const jiti = createJiti(filePath, { interopDefault: true });
  const raw = await jiti.import(filePath, { default: true });
  const config = ContentOpsConfigSchema.parse(raw);
  return { config, path: filePath };
}

function resolveExplicit(path: string, cwd: string): string {
  const abs = isAbsolute(path) ? path : resolve(cwd, path);
  if (!existsSync(abs)) {
    throw new Error(`Config file not found at ${abs}`);
  }
  return abs;
}

function findConfigUpwards(start: string): string | undefined {
  let dir = start;
  while (true) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
