import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import {
  ReleaseLensConfigSchema,
  type ReleaseLensConfig,
} from '@releaselens/core';

const CONFIG_NAMES = [
  'releaselens.config.ts',
  'releaselens.config.mjs',
  'releaselens.config.js',
] as const;

export interface LoadConfigOptions {
  cwd?: string;
  explicit?: string;
}

export interface LoadedConfig {
  config: ReleaseLensConfig;
  path: string;
}

export class ConfigNotFoundError extends Error {
  constructor(public readonly cwd: string) {
    super(
      `No releaselens.config.{ts,mjs,js} found starting from ${cwd}. Run "releaselens init" to scaffold one.`,
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

  const jiti = createJiti(filePath, {
    interopDefault: true,
    alias: buildConfigAlias(),
  });
  const raw = await jiti.import(filePath, { default: true });
  const config = ReleaseLensConfigSchema.parse(raw);
  return { config, path: filePath };
}

// The scaffolded config imports `@releaselens/core`, but it is only a
// dependency of this CLI — under pnpm's strict node_modules or `npx`, it is not
// resolvable from the user's project. Alias it to the copy shipped with the CLI
// so the config loads without requiring the user to install core directly.
function buildConfigAlias(): Record<string, string> {
  try {
    return {
      '@releaselens/core': fileURLToPath(
        import.meta.resolve('@releaselens/core'),
      ),
    };
  } catch {
    return {};
  }
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
