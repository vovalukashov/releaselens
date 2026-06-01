import ts from 'typescript';

export interface MetadataRef {
  /** Import specifier of the module holding the metadata object. */
  from: string;
  /** Name of the export to read in that module (`default`, `metadata`, or any base name). */
  exportName: string;
}

export interface SeoMetadata {
  hasMetadata: boolean;
  hasGenerateMetadata: boolean;
  /** Field presence — true even when the value is a non-literal expression (e.g. `title: siteConfig.name`). */
  hasTitle: boolean;
  hasDescription: boolean;
  hasCanonical: boolean;
  hasHreflang: boolean;
  /** A spread (e.g. `...getLocaleMetadata(...)`) appeared in the metadata object — fields may be set dynamically. Used to downgrade confidence on missing-field findings. */
  hasMetadataSpread: boolean;
  /** Metadata came from a helper-call (e.g. `setMetadata({ canonical })`) — the wrapper may fill defaults the parser cannot see. Used to downgrade confidence. */
  hasMetadataHelperWrap: boolean;
  /**
   * External modules whose metadata must be resolved and merged in. Produced by
   * `export { default as metadata } from '...'`, `export const metadata = importedBase`,
   * and `...importedBase` spreads. Each entry is the import specifier plus the
   * export name to read in that module. The caller resolves them.
   */
  metadataRefs?: MetadataRef[];
  /** Literal values, populated only when the field is a string/object literal. */
  title?: string;
  description?: string;
  canonical?: string;
  hreflang?: Record<string, string>;
  robotsIndex?: boolean;
}

export function parseSeoMetadata(
  source: string,
  fileName = 'virtual.tsx',
  targetName = 'metadata',
): SeoMetadata {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  const result: SeoMetadata = {
    hasMetadata: false,
    hasGenerateMetadata: false,
    hasTitle: false,
    hasDescription: false,
    hasCanonical: false,
    hasHreflang: false,
    hasMetadataSpread: false,
    hasMetadataHelperWrap: false,
  };

  const imports = buildImportMap(sf);

  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const name = decl.name.text;
        const init = decl.initializer;

        if (name === targetName) {
          if (ts.isObjectLiteralExpression(init)) {
            result.hasMetadata = true;
            extractMetadataFields(init, result, imports);
          } else if (ts.isCallExpression(init)) {
            extractFromHelperCall(init, result, imports);
          } else if (ts.isIdentifier(init)) {
            resolveIdentifierMetadata(init.text, sf, imports, result);
          }
        } else if (
          targetName === 'metadata' &&
          name === 'generateMetadata' &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
        ) {
          result.hasGenerateMetadata = true;
          extractFromGenerateMetadata(init, result, imports);
        }
      }
    } else if (
      targetName === 'metadata' &&
      ts.isFunctionDeclaration(stmt) &&
      hasExportModifier(stmt) &&
      stmt.name?.text === 'generateMetadata'
    ) {
      result.hasGenerateMetadata = true;
      extractFromGenerateMetadata(stmt, result, imports);
    } else if (
      (targetName === 'metadata' || targetName === 'default') &&
      ts.isExportAssignment(stmt) &&
      !stmt.isExportEquals
    ) {
      extractFromDefaultExport(stmt.expression, sf, imports, result);
    } else if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.exportClause &&
      ts.isNamedExports(stmt.exportClause)
    ) {
      for (const el of stmt.exportClause.elements) {
        if (el.name.text === targetName) {
          const orig = (el.propertyName ?? el.name).text;
          pushRef(result, stmt.moduleSpecifier.text, orig);
        }
      }
    }
  }

  return result;
}

function buildImportMap(
  sf: ts.SourceFile,
): Map<string, { from: string; orig: string }> {
  const map = new Map<string, { from: string; orig: string }>();
  for (const stmt of sf.statements) {
    if (
      !ts.isImportDeclaration(stmt) ||
      !stmt.importClause ||
      !ts.isStringLiteral(stmt.moduleSpecifier)
    ) {
      continue;
    }
    const from = stmt.moduleSpecifier.text;
    if (stmt.importClause.name) {
      map.set(stmt.importClause.name.text, { from, orig: 'default' });
    }
    const bindings = stmt.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        map.set(el.name.text, {
          from,
          orig: (el.propertyName ?? el.name).text,
        });
      }
    }
  }
  return map;
}

function pushRef(result: SeoMetadata, from: string, exportName: string): void {
  (result.metadataRefs ??= []).push({ from, exportName });
}

/**
 * `export const metadata = someIdentifier` — resolve the identifier to a local
 * object literal (inline) or to an import (recorded as a ref for the caller to
 * follow into the other module).
 */
function resolveIdentifierMetadata(
  name: string,
  sf: ts.SourceFile,
  imports: Map<string, { from: string; orig: string }>,
  result: SeoMetadata,
): void {
  const local = findLocalObject(sf, name);
  if (local) {
    result.hasMetadata = true;
    extractMetadataFields(local, result, imports);
    return;
  }
  const imported = imports.get(name);
  if (imported) pushRef(result, imported.from, imported.orig);
}

/**
 * `export default <expr>` where the file is a metadata module — an object
 * literal, a helper call, or an identifier bound to a local object literal.
 * A function/arrow default is the route's component, not metadata, so it is
 * ignored.
 */
function extractFromDefaultExport(
  expr: ts.Expression,
  sf: ts.SourceFile,
  imports: Map<string, { from: string; orig: string }>,
  result: SeoMetadata,
): void {
  if (ts.isObjectLiteralExpression(expr)) {
    result.hasMetadata = true;
    extractMetadataFields(expr, result, imports);
  } else if (ts.isCallExpression(expr)) {
    extractFromHelperCall(expr, result, imports);
  } else if (ts.isIdentifier(expr)) {
    resolveIdentifierMetadata(expr.text, sf, imports, result);
  }
}

function findLocalObject(
  sf: ts.SourceFile,
  name: string,
): ts.ObjectLiteralExpression | undefined {
  for (const s of sf.statements) {
    if (!ts.isVariableStatement(s)) continue;
    for (const d of s.declarationList.declarations) {
      if (
        ts.isIdentifier(d.name) &&
        d.name.text === name &&
        d.initializer &&
        ts.isObjectLiteralExpression(d.initializer)
      ) {
        return d.initializer;
      }
    }
  }
  return undefined;
}

/**
 * Merge metadata layers from app root down to the page (page last wins),
 * mirroring how Next.js cascades `metadata` through nested layouts.
 */
export function mergeSeoMetadata(layers: SeoMetadata[]): SeoMetadata {
  const merged: SeoMetadata = {
    hasMetadata: false,
    hasGenerateMetadata: false,
    hasTitle: false,
    hasDescription: false,
    hasCanonical: false,
    hasHreflang: false,
    hasMetadataSpread: false,
    hasMetadataHelperWrap: false,
  };
  for (const layer of layers) {
    if (layer.hasMetadata) merged.hasMetadata = true;
    if (layer.hasGenerateMetadata) merged.hasGenerateMetadata = true;
    if (layer.hasTitle) merged.hasTitle = true;
    if (layer.hasDescription) merged.hasDescription = true;
    if (layer.hasCanonical) merged.hasCanonical = true;
    if (layer.hasHreflang) merged.hasHreflang = true;
    if (layer.hasMetadataSpread) merged.hasMetadataSpread = true;
    if (layer.hasMetadataHelperWrap) merged.hasMetadataHelperWrap = true;
    if (layer.title !== undefined) merged.title = layer.title;
    if (layer.description !== undefined) merged.description = layer.description;
    if (layer.canonical !== undefined) merged.canonical = layer.canonical;
    if (layer.hreflang !== undefined) merged.hreflang = layer.hreflang;
    if (layer.robotsIndex !== undefined) merged.robotsIndex = layer.robotsIndex;
  }
  return merged;
}

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(
    ts.getCombinedModifierFlags(node as ts.Declaration) &
      ts.ModifierFlags.Export,
  );
}

function extractMetadataFields(
  obj: ts.ObjectLiteralExpression,
  result: SeoMetadata,
  imports: Map<string, { from: string; orig: string }>,
): void {
  for (const prop of obj.properties) {
    if (ts.isSpreadAssignment(prop)) {
      result.hasMetadataSpread = true;
      if (ts.isIdentifier(prop.expression)) {
        const imported = imports.get(prop.expression.text);
        if (imported) pushRef(result, imported.from, imported.orig);
      }
      continue;
    }
    if (ts.isShorthandPropertyAssignment(prop)) {
      markPresence(prop.name.text, result);
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = getPropertyKey(prop);
    if (!key) continue;

    if (key === 'title') {
      result.hasTitle = true;
      const titleText = readStringOrDefault(prop.initializer);
      if (titleText !== undefined) result.title = titleText;
    } else if (key === 'description') {
      result.hasDescription = true;
      const text = readString(prop.initializer);
      if (text !== undefined) result.description = text;
    } else if (key === 'canonical') {
      result.hasCanonical = true;
      const text = readString(prop.initializer);
      if (text !== undefined) result.canonical = text;
    } else if (key === 'languages') {
      extractLanguages(prop.initializer, result);
    } else if (key === 'alternates' && ts.isObjectLiteralExpression(prop.initializer)) {
      extractAlternates(prop.initializer, result);
    } else if (key === 'robots') {
      extractRobots(prop.initializer, result);
    } else if (key === 'noIndex') {
      if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
        result.robotsIndex = false;
      } else if (prop.initializer.kind === ts.SyntaxKind.FalseKeyword) {
        result.robotsIndex = true;
      }
    }
  }
}

function extractLanguages(node: ts.Expression, result: SeoMetadata): void {
  result.hasHreflang = true;
  if (!ts.isObjectLiteralExpression(node)) return;
  const languages: Record<string, string> = {};
  for (const lang of node.properties) {
    if (!ts.isPropertyAssignment(lang)) continue;
    const langKey = getPropertyKey(lang);
    const langValue = readString(lang.initializer);
    if (langKey && langValue !== undefined) {
      languages[langKey] = langValue;
    }
  }
  if (Object.keys(languages).length > 0) {
    result.hreflang = languages;
  }
}

/**
 * Pull metadata out of a helper-wrapped expression — e.g. `setMetadata({title, ...})`.
 * Takes the first object-literal argument and treats it as if it were a static `metadata`.
 */
function extractFromHelperCall(
  call: ts.CallExpression,
  result: SeoMetadata,
  imports: Map<string, { from: string; orig: string }>,
): void {
  for (const arg of call.arguments) {
    if (ts.isObjectLiteralExpression(arg)) {
      result.hasMetadata = true;
      result.hasMetadataHelperWrap = true;
      extractMetadataFields(arg, result, imports);
      return;
    }
  }
  // Helper call with no literal argument still signals helper-wrap presence,
  // so missing-field findings get downgraded to low confidence.
  result.hasMetadataHelperWrap = true;
}

/**
 * Walk a `generateMetadata` function body and try to extract the returned
 * metadata object — covers `return setMetadata({...})`, `return {...}`,
 * `const m = {...}; return m`, and arrow concise bodies.
 */
function extractFromGenerateMetadata(
  fn: ts.FunctionLikeDeclaration,
  result: SeoMetadata,
  imports: Map<string, { from: string; orig: string }>,
): void {
  const body = fn.body;
  if (!body) return;

  if (!ts.isBlock(body)) {
    extractFromReturnExpr(body, result, new Map(), imports);
    return;
  }

  const locals = new Map<string, ts.ObjectLiteralExpression>();
  for (const s of body.statements) {
    if (!ts.isVariableStatement(s)) continue;
    for (const d of s.declarationList.declarations) {
      if (
        ts.isIdentifier(d.name) &&
        d.initializer &&
        ts.isObjectLiteralExpression(d.initializer)
      ) {
        locals.set(d.name.text, d.initializer);
      }
    }
  }

  for (const s of body.statements) {
    if (ts.isReturnStatement(s) && s.expression) {
      extractFromReturnExpr(s.expression, result, locals, imports);
    }
  }
}

function extractFromReturnExpr(
  expr: ts.Expression,
  result: SeoMetadata,
  locals: Map<string, ts.ObjectLiteralExpression>,
  imports: Map<string, { from: string; orig: string }>,
): void {
  if (ts.isAwaitExpression(expr)) {
    extractFromReturnExpr(expr.expression, result, locals, imports);
    return;
  }
  if (ts.isParenthesizedExpression(expr)) {
    extractFromReturnExpr(expr.expression, result, locals, imports);
    return;
  }
  if (ts.isObjectLiteralExpression(expr)) {
    result.hasMetadata = true;
    extractMetadataFields(expr, result, imports);
    return;
  }
  if (ts.isCallExpression(expr)) {
    extractFromHelperCall(expr, result, imports);
    return;
  }
  if (ts.isIdentifier(expr)) {
    const obj = locals.get(expr.text);
    if (obj) {
      result.hasMetadata = true;
      extractMetadataFields(obj, result, imports);
    }
  }
}

function extractAlternates(
  obj: ts.ObjectLiteralExpression,
  result: SeoMetadata,
): void {
  for (const prop of obj.properties) {
    if (ts.isShorthandPropertyAssignment(prop)) {
      const key = prop.name.text;
      if (key === 'canonical') result.hasCanonical = true;
      else if (key === 'languages') result.hasHreflang = true;
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = getPropertyKey(prop);
    if (!key) continue;

    if (key === 'canonical') {
      result.hasCanonical = true;
      const text = readString(prop.initializer);
      if (text !== undefined) result.canonical = text;
    } else if (key === 'languages') {
      result.hasHreflang = true;
      if (ts.isObjectLiteralExpression(prop.initializer)) {
        const languages: Record<string, string> = {};
        for (const lang of prop.initializer.properties) {
          if (!ts.isPropertyAssignment(lang)) continue;
          const langKey = getPropertyKey(lang);
          const langValue = readString(lang.initializer);
          if (langKey && langValue !== undefined) {
            languages[langKey] = langValue;
          }
        }
        if (Object.keys(languages).length > 0) {
          result.hreflang = languages;
        }
      }
    }
  }
}

function extractRobots(node: ts.Expression, result: SeoMetadata): void {
  const text = readString(node);
  if (text !== undefined) {
    const lower = text.toLowerCase();
    if (lower.includes('noindex')) result.robotsIndex = false;
    else if (lower.includes('index')) result.robotsIndex = true;
    return;
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (getPropertyKey(prop) === 'index') {
        if (prop.initializer.kind === ts.SyntaxKind.TrueKeyword) {
          result.robotsIndex = true;
        } else if (prop.initializer.kind === ts.SyntaxKind.FalseKeyword) {
          result.robotsIndex = false;
        }
      }
    }
  }
}

function readString(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function readStringOrDefault(node: ts.Expression): string | undefined {
  const direct = readString(node);
  if (direct !== undefined) return direct;
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (
        ts.isPropertyAssignment(prop) &&
        getPropertyKey(prop) === 'default'
      ) {
        return readString(prop.initializer);
      }
    }
  }
  return undefined;
}

function markPresence(key: string, result: SeoMetadata): void {
  if (key === 'title') result.hasTitle = true;
  else if (key === 'description') result.hasDescription = true;
  else if (key === 'canonical') result.hasCanonical = true;
  else if (key === 'languages') result.hasHreflang = true;
}

function getPropertyKey(prop: ts.PropertyAssignment): string | undefined {
  if (ts.isIdentifier(prop.name)) return prop.name.text;
  if (ts.isStringLiteral(prop.name)) return prop.name.text;
  return undefined;
}
