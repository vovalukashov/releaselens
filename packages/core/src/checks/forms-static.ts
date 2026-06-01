import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseJsxForms, type ParsedForm } from '../forms/parse-jsx-forms.js';
import type { Check, CheckResult } from '../types.js';

const SCAN_EXTENSIONS = new Set(['.tsx', '.jsx']);
const SCAN_SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist']);
const CHECK_ID = 'forms-static';

export const formsStaticCheck: Check = {
  id: CHECK_ID,
  description:
    'Verify each declared form exists in the codebase with a submit mechanism (action, onSubmit, or submit button).',
  defaultSeverity: 'critical',
  defaultConfidence: 'high',
  run({ config, cwd }) {
    const results: CheckResult[] = [];
    if (config.forms.length === 0) return results;

    const appDir = resolve(cwd, config.appDir);
    if (!existsSync(appDir)) return results;

    const scanDirs = new Set<string>([appDir]);
    for (const dir of config.frontendDirs) {
      const abs = resolve(cwd, dir);
      if (existsSync(abs)) scanDirs.add(abs);
    }

    const allForms: ParsedForm[] = [];
    const seen = new Set<string>();
    for (const dir of scanDirs) {
      for (const file of walkFiles(dir)) {
        if (seen.has(file)) continue;
        seen.add(file);
        const source = readFileSync(file, 'utf8');
        allForms.push(...parseJsxForms(source, file));
      }
    }

    const routeById = new Map(config.routes.map((r) => [r.id, r]));

    for (const form of config.forms) {
      const matcher = parseSelector(form.selector);
      const route = routeById.get(form.onRoute);
      const routeRef = route ? ` (route "${form.onRoute}")` : '';

      if (!matcher) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'selector-unparseable',
          severity: 'info',
          confidence: 'low',
          message: `Form "${form.id}": selector \`${form.selector}\` could not be parsed. Supported forms: \`[attr=value]\` (one or more, ANDed) or \`file:<path-suffix>\`.`,
          form: form.id,
          ...(route ? { route: route.id } : {}),
        });
        continue;
      }

      const match = allForms.find(matcher);
      if (!match) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'form-not-found',
          severity: 'critical',
          confidence: 'high',
          message: `Form "${form.id}"${routeRef}: no <form> matching selector \`${form.selector}\` found anywhere under ${config.appDir}.`,
          form: form.id,
          ...(route ? { route: route.id } : {}),
        });
        continue;
      }

      if (!match.hasAction && !match.hasOnSubmit && !match.hasSubmitButton) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'submit-mechanism-missing',
          severity: 'warning',
          confidence: 'high',
          message: `Form "${form.id}"${routeRef}: no submit mechanism detected (missing action, onSubmit, or submit button).`,
          form: form.id,
          ...(route ? { route: route.id } : {}),
        });
      }
    }

    return results;
  },
};

function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SCAN_SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walkFiles(full);
    } else if (stat.isFile()) {
      const dotIdx = entry.lastIndexOf('.');
      if (dotIdx === -1) continue;
      const ext = entry.slice(dotIdx);
      if (SCAN_EXTENSIONS.has(ext)) {
        yield full;
      }
    }
  }
}

/**
 * Selector grammar:
 *  - `[<attr>=<value>]` (one or more, ANDed) — match a `<form>` whose string
 *     attributes include every clause. Examples: `[data-form=lead]`,
 *     `[name=email]`, `[id=demo][aria-label="Book a demo"]`.
 *  - `file:<path-suffix>` — match any `<form>` parsed from a file whose path
 *     ends with `<path-suffix>`. Example: `file:book-a-demo-call/client.tsx`.
 */
function parseSelector(
  selector: string,
): ((form: ParsedForm) => boolean) | null {
  const trimmed = selector.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('file:')) {
    const target = trimmed.slice(5).trim();
    if (!target) return null;
    return (form) => form.file.endsWith(target);
  }

  const clauses: Array<{ attr: string; value: string }> = [];
  const re = /\[\s*([a-zA-Z_-][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]+?))\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    const attr = m[1]!;
    const value = (m[2] ?? m[3] ?? m[4] ?? '').trim();
    clauses.push({ attr, value });
  }
  if (clauses.length === 0) return null;
  return (form) => clauses.every((c) => form.attrs[c.attr] === c.value);
}
