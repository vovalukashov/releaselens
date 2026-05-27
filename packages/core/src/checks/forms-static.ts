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

    const allForms: ParsedForm[] = [];
    for (const file of walkFiles(appDir)) {
      const source = readFileSync(file, 'utf8');
      allForms.push(...parseJsxForms(source, file));
    }

    const routeById = new Map(config.routes.map((r) => [r.id, r]));

    for (const form of config.forms) {
      const dataFormToken = extractDataFormToken(form.selector);
      const route = routeById.get(form.onRoute);
      const routeRef = route ? ` (route "${form.onRoute}")` : '';

      if (!dataFormToken) {
        results.push({
          checkId: CHECK_ID,
          severity: 'info',
          confidence: 'low',
          message: `Form "${form.id}": selector \`${form.selector}\` does not include a \`data-form\` attribute — static lookup limited.`,
          form: form.id,
          ...(route ? { route: route.id } : {}),
        });
        continue;
      }

      const match = allForms.find((f) => f.dataForm === dataFormToken);
      if (!match) {
        results.push({
          checkId: CHECK_ID,
          severity: 'critical',
          confidence: 'high',
          message: `Form "${form.id}"${routeRef}: no <form data-form="${dataFormToken}"> found anywhere under ${config.appDir}.`,
          form: form.id,
          ...(route ? { route: route.id } : {}),
        });
        continue;
      }

      if (!match.action && !match.hasOnSubmit && !match.hasSubmitButton) {
        results.push({
          checkId: CHECK_ID,
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

function extractDataFormToken(selector: string): string | undefined {
  const match = selector.match(/\[data-form=["']?([^"'\]]+)["']?\]/);
  return match?.[1];
}
