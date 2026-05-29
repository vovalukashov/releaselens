import ts from 'typescript';

export interface SeoMetadata {
  hasMetadata: boolean;
  hasGenerateMetadata: boolean;
  /** Field presence — true even when the value is a non-literal expression (e.g. `title: siteConfig.name`). */
  hasTitle: boolean;
  hasDescription: boolean;
  hasCanonical: boolean;
  hasHreflang: boolean;
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
  };

  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt) && hasExportModifier(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === 'metadata' &&
          decl.initializer &&
          ts.isObjectLiteralExpression(decl.initializer)
        ) {
          result.hasMetadata = true;
          extractMetadataFields(decl.initializer, result);
        }
      }
    } else if (
      ts.isFunctionDeclaration(stmt) &&
      hasExportModifier(stmt) &&
      stmt.name?.text === 'generateMetadata'
    ) {
      result.hasGenerateMetadata = true;
    }
  }

  return result;
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
  };
  for (const layer of layers) {
    if (layer.hasMetadata) merged.hasMetadata = true;
    if (layer.hasGenerateMetadata) merged.hasGenerateMetadata = true;
    if (layer.hasTitle) merged.hasTitle = true;
    if (layer.hasDescription) merged.hasDescription = true;
    if (layer.hasCanonical) merged.hasCanonical = true;
    if (layer.hasHreflang) merged.hasHreflang = true;
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
): void {
  for (const prop of obj.properties) {
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
    } else if (key === 'alternates' && ts.isObjectLiteralExpression(prop.initializer)) {
      extractAlternates(prop.initializer, result);
    } else if (key === 'robots') {
      extractRobots(prop.initializer, result);
    }
  }
}

function extractAlternates(
  obj: ts.ObjectLiteralExpression,
  result: SeoMetadata,
): void {
  for (const prop of obj.properties) {
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

function getPropertyKey(prop: ts.PropertyAssignment): string | undefined {
  if (ts.isIdentifier(prop.name)) return prop.name.text;
  if (ts.isStringLiteral(prop.name)) return prop.name.text;
  return undefined;
}
