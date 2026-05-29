import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectLayoutFiles, findPageFile } from '../src/checks/find-page-file.js';

let appDir: string;

function write(relativePath: string, contents = ''): string {
  const abs = join(appDir, relativePath);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, contents);
  return abs;
}

beforeEach(() => {
  appDir = join(mkdtempSync(join(tmpdir(), 'rl-app-')), 'app');
  mkdirSync(appDir, { recursive: true });
});

afterEach(() => {
  rmSync(join(appDir, '..'), { recursive: true, force: true });
});

describe('findPageFile', () => {
  it('resolves a route through a route group', () => {
    const page = write('(marketing)/pricing/page.tsx');
    expect(findPageFile(appDir, '/pricing')).toBe(page);
  });

  it('resolves the root route', () => {
    const page = write('(marketing)/page.tsx');
    expect(findPageFile(appDir, '/')).toBe(page);
  });

  it('resolves through nested route groups', () => {
    const page = write('(marketing)/(promos)/black-friday/page.tsx');
    expect(findPageFile(appDir, '/black-friday')).toBe(page);
  });

  it('ignores parallel-route slots', () => {
    const page = write('@modal/login/page.tsx');
    expect(findPageFile(appDir, '/login')).toBe(page);
  });

  it('resolves a locale-prefixed route', () => {
    write('(marketing)/pricing/page.tsx');
    const es = write('es/(marketing)/pricing/page.tsx');
    expect(findPageFile(appDir, '/pricing', 'es')).toBe(es);
  });

  it('returns undefined when no page matches', () => {
    write('(marketing)/pricing/page.tsx');
    expect(findPageFile(appDir, '/contact')).toBeUndefined();
  });
});

describe('collectLayoutFiles', () => {
  it('collects layouts from app root down to the page directory', () => {
    const root = write('layout.tsx');
    const groupLayout = write('(marketing)/layout.tsx');
    const page = write('(marketing)/pricing/page.tsx');
    expect(collectLayoutFiles(appDir, page)).toEqual([root, groupLayout]);
  });

  it('returns an empty list when no layouts exist', () => {
    const page = write('(marketing)/pricing/page.tsx');
    expect(collectLayoutFiles(appDir, page)).toEqual([]);
  });
});
