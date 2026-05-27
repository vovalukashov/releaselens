import ts from 'typescript';

export interface SeoMetadata {
  hasMetadata: boolean;
  hasGenerateMetadata: boolean;
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
      const titleText = readStringOrDefault(prop.initializer);
      if (titleText !== undefined) result.title = titleText;
    } else if (key === 'description') {
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
      const text = readString(prop.initializer);
      if (text !== undefined) result.canonical = text;
    } else if (key === 'languages' && ts.isObjectLiteralExpression(prop.initializer)) {
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
