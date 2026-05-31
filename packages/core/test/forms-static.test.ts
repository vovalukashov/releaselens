import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defineReleaseLens } from '../src/config.js';
import { parseJsxForms } from '../src/forms/parse-jsx-forms.js';
import { formsStaticCheck } from '../src/checks/forms-static.js';

describe('parseJsxForms', () => {
  it('finds form with data-form, action, and submit button', () => {
    const source = `
      export default function Page() {
        return (
          <form data-form="pricing-lead" action="/api/lead" method="post">
            <input name="email" />
            <button type="submit">Submit</button>
          </form>
        );
      }
    `;
    const forms = parseJsxForms(source);
    expect(forms).toHaveLength(1);
    expect(forms[0]?.dataForm).toBe('pricing-lead');
    expect(forms[0]?.action).toBe('/api/lead');
    expect(forms[0]?.hasSubmitButton).toBe(true);
    expect(forms[0]?.hasOnSubmit).toBe(false);
  });

  it('detects onSubmit handler', () => {
    const source = `
      'use client';
      export function ClientForm() {
        return (
          <form data-form="x" onSubmit={(e) => e.preventDefault()}>
            <input name="x" />
          </form>
        );
      }
    `;
    const forms = parseJsxForms(source);
    expect(forms).toHaveLength(1);
    expect(forms[0]?.hasOnSubmit).toBe(true);
  });

  it('finds no form when none present', () => {
    const source = `export default function Page() { return <div />; }`;
    const forms = parseJsxForms(source);
    expect(forms).toHaveLength(0);
  });

  it('flags missing submit mechanism', () => {
    const source = `
      export default function Page() {
        return (
          <form data-form="naked">
            <input name="x" />
          </form>
        );
      }
    `;
    const forms = parseJsxForms(source);
    expect(forms[0]?.action).toBeUndefined();
    expect(forms[0]?.hasOnSubmit).toBe(false);
    expect(forms[0]?.hasSubmitButton).toBe(false);
  });

  it('captures all string attrs plus file path (forwarded into the check)', () => {
    const source = `
      export function F() {
        return (
          <form name="email-form" id="demo" aria-label="Book a demo" onSubmit={handleSubmit(x)}>
            <input />
          </form>
        );
      }
    `;
    const forms = parseJsxForms(source, '/abs/path/client.tsx');
    expect(forms[0]?.attrs).toMatchObject({
      name: 'email-form',
      id: 'demo',
      'aria-label': 'Book a demo',
    });
    expect(forms[0]?.file).toBe('/abs/path/client.tsx');
    expect(forms[0]?.hasOnSubmit).toBe(true);
  });
});

describe('formsStaticCheck selectors', () => {
  let cwd: string;
  let appDir: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'rl-forms-'));
    appDir = join(cwd, 'app');
    mkdirSync(appDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  function writePage(rel: string, body: string): void {
    const abs = join(appDir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(
      abs,
      `export default function Page() { return (${body}); }`,
    );
  }

  it('finds a form by [data-form=X] (backward-compat)', async () => {
    writePage(
      'pricing/page.tsx',
      `<form data-form="lead" onSubmit={x}><input/></form>`,
    );
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'pricing', path: '/pricing' }],
      forms: [
        {
          id: 'lead',
          onRoute: 'pricing',
          selector: '[data-form=lead]',
          successState: { type: 'route', value: '/ok' },
        },
      ],
    });
    const results = await formsStaticCheck.run({ config: cfg, cwd });
    expect(results).toHaveLength(0);
  });

  it('finds a form by [name=X] when no data-form is present', async () => {
    writePage(
      'subscribe/page.tsx',
      `<form name="email-form" onSubmit={x}><input/></form>`,
    );
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'subscribe', path: '/subscribe' }],
      forms: [
        {
          id: 'subscribe',
          onRoute: 'subscribe',
          selector: '[name=email-form]',
          successState: { type: 'route', value: '/ok' },
        },
      ],
    });
    const results = await formsStaticCheck.run({ config: cfg, cwd });
    expect(results).toHaveLength(0);
  });

  it('AND-matches multiple attribute clauses', async () => {
    writePage(
      'demo/page.tsx',
      `<form id="demo" aria-label="Book a demo" onSubmit={x}><input/></form>`,
    );
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'demo', path: '/demo' }],
      forms: [
        {
          id: 'demo-form',
          onRoute: 'demo',
          selector: '[id=demo][aria-label="Book a demo"]',
          successState: { type: 'route', value: '/ok' },
        },
      ],
    });
    const results = await formsStaticCheck.run({ config: cfg, cwd });
    expect(results).toHaveLength(0);
  });

  it('finds a form by file:<path-suffix>', async () => {
    writePage(
      'pricing/book-a-demo-call/client.tsx',
      `<form onSubmit={handleSubmit(x)}><input/></form>`,
    );
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'pricing', path: '/pricing' }],
      forms: [
        {
          id: 'book-demo',
          onRoute: 'pricing',
          selector: 'file:book-a-demo-call/client.tsx',
          successState: { type: 'route', value: '/ok' },
        },
      ],
    });
    const results = await formsStaticCheck.run({ config: cfg, cwd });
    expect(results).toHaveLength(0);
  });

  it('emits form-not-found when the selector matches nothing', async () => {
    writePage('a/page.tsx', `<form name="b" onSubmit={x}><input/></form>`);
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'a', path: '/a' }],
      forms: [
        {
          id: 'a',
          onRoute: 'a',
          selector: '[name=nonexistent]',
          successState: { type: 'route', value: '/ok' },
        },
      ],
    });
    const results = await formsStaticCheck.run({ config: cfg, cwd });
    expect(results).toHaveLength(1);
    expect(results[0]?.issueKey).toBe('form-not-found');
  });

  it('emits selector-unparseable when the selector is garbage', async () => {
    writePage('a/page.tsx', `<form onSubmit={x}><input/></form>`);
    const cfg = defineReleaseLens({
      appDir: './app',
      routes: [{ id: 'a', path: '/a' }],
      forms: [
        {
          id: 'a',
          onRoute: 'a',
          selector: 'just-some-string',
          successState: { type: 'route', value: '/ok' },
        },
      ],
    });
    const results = await formsStaticCheck.run({ config: cfg, cwd });
    expect(results).toHaveLength(1);
    expect(results[0]?.issueKey).toBe('selector-unparseable');
  });
});
