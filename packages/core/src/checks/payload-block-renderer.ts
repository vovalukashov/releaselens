import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { loadPayloadModel } from '../adapters/payload/load-payload.js';
import type { Check, CheckResult } from '../types.js';

const SCAN_EXTENSIONS = new Set(['.tsx', '.jsx']);
const SCAN_SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist']);
const CHECK_ID = 'payload-block-renderer';

export const payloadBlockRendererCheck: Check = {
  id: CHECK_ID,
  description:
    'For every block defined in the Payload schema, verify a matching frontend component exists (by identifier name).',
  defaultSeverity: 'critical',
  defaultConfidence: 'medium',
  async run({ config, cwd }) {
    const payloadCfg = config.adapters.payload;
    if (!payloadCfg) return [];

    const absConfig = resolve(cwd, payloadCfg.config);
    if (!existsSync(absConfig)) return [];

    let model;
    try {
      model = await loadPayloadModel(payloadCfg.config, cwd);
    } catch {
      return [];
    }

    if (model.blocks.length === 0) return [];

    const componentNames = collectComponentIdentifiers(
      config.frontendDirs,
      cwd,
    );

    const results: CheckResult[] = [];
    for (const block of model.blocks) {
      const blockName = block.slug;
      const variants = candidateNames(blockName);
      const hit = variants.some((name) => componentNames.has(name));
      if (!hit) {
        results.push({
          checkId: CHECK_ID,
          issueKey: 'payload-block-no-renderer',
          severity: 'critical',
          confidence: 'medium',
          message: `Payload block "${blockName}" has no matching frontend component (looked for: ${variants.join(', ')}) in [${config.frontendDirs.join(', ')}].`,
          data: { block: blockName, source: block.source },
        });
      }
    }
    return results;
  },
};

function candidateNames(slug: string): string[] {
  const pascal = toPascalCase(slug);
  return Array.from(new Set([slug, pascal, `${pascal}Block`]));
}

function toPascalCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ''))
    .join('');
}

function collectComponentIdentifiers(
  dirs: string[],
  cwd: string,
): Set<string> {
  const names = new Set<string>();
  for (const dir of dirs) {
    const abs = resolve(cwd, dir);
    if (!existsSync(abs)) continue;
    for (const file of walkFiles(abs)) {
      const source = readFileSync(file, 'utf8');
      collectFromSource(source, file, names);
    }
  }
  return names;
}

function collectFromSource(
  source: string,
  fileName: string,
  out: Set<string>,
): void {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const clause = node.importClause;
      if (clause.name) out.add(clause.name.text);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const spec of clause.namedBindings.elements) {
          out.add(spec.name.text);
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      out.add(node.name.text);
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) out.add(decl.name.text);
      }
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node)
        ? node.openingElement.tagName
        : node.tagName;
      if (ts.isIdentifier(tagName)) out.add(tagName.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

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
