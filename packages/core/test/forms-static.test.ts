import { describe, expect, it } from 'vitest';
import { parseJsxForms } from '../src/forms/parse-jsx-forms.js';

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
});
