import ts from 'typescript';

export interface ParsedForm {
  /** All string-valued attributes on the `<form>` element (data-form, name, id, aria-label, action, role, …). */
  attrs: Record<string, string>;
  hasOnSubmit: boolean;
  hasSubmitButton: boolean;
  /** Source file path the form was found in (relative or absolute, as passed to `parseJsxForms`). */
  file: string;
  /** Legacy convenience accessor — equivalent to `attrs['data-form']`. */
  dataForm?: string;
  /** Legacy convenience accessor — equivalent to `attrs.action`. */
  action?: string;
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
      forms.push(extractForm(node, fileName));
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
  file: string,
): ParsedForm {
  const attributes =
    ts.isJsxElement(node)
      ? node.openingElement.attributes
      : node.attributes;
  const rawAttrs = readAttrs(attributes);
  const stringAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawAttrs)) {
    if (typeof v === 'string') stringAttrs[k] = v;
  }
  const form: ParsedForm = {
    attrs: stringAttrs,
    hasOnSubmit: Object.prototype.hasOwnProperty.call(rawAttrs, 'onSubmit'),
    hasSubmitButton: ts.isJsxElement(node) ? hasSubmitDescendant(node) : false,
    file,
  };
  if (typeof rawAttrs['data-form'] === 'string') {
    form.dataForm = rawAttrs['data-form'];
  }
  if (typeof rawAttrs.action === 'string') {
    form.action = rawAttrs.action;
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
