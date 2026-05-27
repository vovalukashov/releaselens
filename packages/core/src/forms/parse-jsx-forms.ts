import ts from 'typescript';

export interface ParsedForm {
  dataForm?: string;
  action?: string;
  hasOnSubmit: boolean;
  hasSubmitButton: boolean;
}

export function parseJsxForms(
  source: string,
  fileName = 'virtual.tsx',
): ParsedForm[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  const forms: ParsedForm[] = [];
  visit(sf);
  return forms;

  function visit(node: ts.Node): void {
    if (isFormJsx(node)) {
      forms.push(extractForm(node));
    }
    ts.forEachChild(node, visit);
  }
}

function isFormJsx(node: ts.Node): node is ts.JsxElement | ts.JsxSelfClosingElement {
  if (ts.isJsxElement(node)) {
    return getTagName(node.openingElement.tagName) === 'form';
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return getTagName(node.tagName) === 'form';
  }
  return false;
}

function getTagName(node: ts.JsxTagNameExpression): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  return undefined;
}

function extractForm(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
): ParsedForm {
  const attributes =
    ts.isJsxElement(node)
      ? node.openingElement.attributes
      : node.attributes;
  const attrs = readAttrs(attributes);
  const form: ParsedForm = {
    hasOnSubmit: Object.prototype.hasOwnProperty.call(attrs, 'onSubmit'),
    hasSubmitButton: ts.isJsxElement(node) ? hasSubmitDescendant(node) : false,
  };
  if (typeof attrs['data-form'] === 'string') {
    form.dataForm = attrs['data-form'];
  }
  if (typeof attrs.action === 'string') {
    form.action = attrs.action;
  }
  return form;
}

function readAttrs(attributes: ts.JsxAttributes): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const attr of attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    if (!ts.isIdentifier(attr.name) && !ts.isJsxNamespacedName(attr.name)) {
      continue;
    }
    const name = ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText();
    const init = attr.initializer;
    if (!init) {
      out[name] = true;
      continue;
    }
    if (ts.isStringLiteral(init)) {
      out[name] = init.text;
    } else if (ts.isJsxExpression(init) && init.expression) {
      const expr = init.expression;
      if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
        out[name] = expr.text;
      } else {
        out[name] = true;
      }
    } else {
      out[name] = true;
    }
  }
  return out;
}

function hasSubmitDescendant(element: ts.JsxElement): boolean {
  let found = false;
  visit(element);
  return found;

  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = ts.isJsxElement(node)
        ? getTagName(node.openingElement.tagName)
        : getTagName(node.tagName);
      if (tag === 'button' || tag === 'input') {
        const attrs = readAttrs(
          ts.isJsxElement(node)
            ? node.openingElement.attributes
            : node.attributes,
        );
        if (tag === 'button' && (attrs.type === 'submit' || attrs.type === undefined)) {
          found = true;
          return;
        }
        if (tag === 'input' && attrs.type === 'submit') {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
}
