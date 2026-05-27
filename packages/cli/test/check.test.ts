import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(here, '../dist/index.js');
const FIXTURE = resolve(
  here,
  '../../../examples/basic/releaselens.config.ts',
);

function runCli(args: string[]) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
}

describe('releaselens CLI', () => {
  it('runs check against the basic fixture in text mode', () => {
    const result = runCli(['check', '--config', FIXTURE]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('releaselens');
    expect(result.stdout).toMatch(/Summary/);
  });

  it('emits valid JSON in --json mode', () => {
    const result = runCli(['check', '--config', FIXTURE, '--json']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      passed: boolean;
      counts: Record<string, number>;
    };
    expect(parsed).toHaveProperty('passed');
    expect(parsed.counts).toHaveProperty('critical');
  });

  it('exits non-zero with --ci on a config that violates checks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'releaselens-broken-'));
    const broken = join(dir, 'releaselens.config.mjs');
    writeFileSync(
      broken,
      `export default {
  framework: 'next',
  locales: ['en'],
  defaultLocale: 'en',
  routes: [
    {
      id: 'broken',
      path: '/broken',
      locales: ['en', 'fr'],
    },
  ],
};
`,
      'utf8',
    );

    const result = runCli(['check', '--config', broken, '--ci']);
    expect(result.status).toBe(1);
  });

  it('init creates a config file and refuses to overwrite on the second invocation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'releaselens-init-'));
    const first = runCli(['init', '--dir', dir]);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('Created');

    const second = runCli(['init', '--dir', dir]);
    expect(second.status).toBe(0);
    expect(second.stderr).toContain('already exists');
  });
});
