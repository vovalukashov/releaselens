import { describe, expect, it } from 'vitest';
import type { CheckResult, RunReport } from '@releaselens/core';
import { markdownReport } from '../../src/reporters/markdown.js';

function makeReport(results: CheckResult[]): RunReport {
  const counts = { critical: 0, warning: 0, info: 0 } as RunReport['counts'];
  for (const r of results) counts[r.severity] += 1;
  return {
    results,
    counts,
    passed: counts.critical === 0,
    baselineLoaded: false,
    dismissedCount: 0,
  };
}

describe('markdownReport', () => {
  it('preserves backtick code-spans verbatim — no backslash leaks into them', () => {
    const md = markdownReport(
      makeReport([
        {
          checkId: 'seo-static',
          severity: 'critical',
          confidence: 'high',
          message: 'Route "home": missing `metadata.alternates.canonical` here.',
          route: 'home',
        },
      ]),
      '/path/to/releaselens.config.ts',
    );

    expect(md).toContain('`metadata.alternates.canonical`');
    expect(md).not.toContain('\\`metadata');
    expect(md).not.toContain('canonical\\`');
  });

  it('does not escape `.`, `-`, `(`, `)` in plain text', () => {
    const md = markdownReport(
      makeReport([
        {
          checkId: 'seo-static',
          severity: 'warning',
          confidence: 'high',
          message: 'Route "home" (businessImpact=high): missing description.',
          route: 'home',
        },
      ]),
      '/cfg.ts',
    );

    expect(md).not.toMatch(/\\\./);
    expect(md).not.toMatch(/\\-/);
    expect(md).not.toMatch(/\\\(/);
    expect(md).not.toMatch(/\\\)/);
    expect(md).toContain('(businessImpact=high)');
    expect(md).toContain('missing description.');
  });

  it('escapes characters that genuinely break inline markdown (* _ < > | \\)', () => {
    const md = markdownReport(
      makeReport([
        {
          checkId: 'x',
          severity: 'info',
          confidence: 'low',
          message: 'has *star* and _underscore_ and <tag> and | pipe and \\ slash',
          route: 'home',
        },
      ]),
      '/cfg.ts',
    );

    expect(md).toContain('\\*star\\*');
    expect(md).toContain('\\_underscore\\_');
    expect(md).toContain('\\<tag\\>');
    expect(md).toContain('\\| pipe');
    expect(md).toContain('\\\\ slash');
  });

  it('does not escape `.` or `-` in route headings', () => {
    const md = markdownReport(
      makeReport([
        {
          checkId: 'x',
          severity: 'info',
          confidence: 'low',
          message: 'm',
          route: 'pricing-book-demo',
        },
      ]),
      '/cfg.ts',
    );

    expect(md).toContain('## pricing-book-demo');
    expect(md).not.toContain('pricing\\-book\\-demo');
  });

  it('handles mixed backtick + plain text + special chars in one message', () => {
    const md = markdownReport(
      makeReport([
        {
          checkId: 'seo-static',
          severity: 'critical',
          confidence: 'low',
          message: 'Route "home" (high): missing `metadata.alternates.canonical` (a spread is present).',
          route: 'home',
        },
      ]),
      '/cfg.ts',
    );

    expect(md).toContain('`metadata.alternates.canonical`');
    expect(md).toContain('(a spread is present).');
    expect(md).not.toContain('\\(');
    expect(md).not.toContain('\\.');
  });
});
