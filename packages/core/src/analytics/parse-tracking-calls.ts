import ts from 'typescript';

export interface TrackingCall {
  name: string;
  method: 'track' | 'gtag' | 'posthog.capture' | 'analytics.track';
  line: number;
}

export function parseTrackingCalls(
  source: string,
  fileName = 'virtual.tsx',
): TrackingCall[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  const calls: TrackingCall[] = [];
  visit(sf);
  return calls;

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const call = extractTrackingCall(node, sf);
      if (call) calls.push(call);
    }
    ts.forEachChild(node, visit);
  }
}

function extractTrackingCall(
  node: ts.CallExpression,
  sf: ts.SourceFile,
): TrackingCall | undefined {
  const callee = node.expression;
  const args = node.arguments;
  if (args.length === 0) return undefined;

  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));

  if (ts.isIdentifier(callee)) {
    if (callee.text === 'track') {
      const name = readStringArg(args[0]);
      if (name !== undefined) return { name, method: 'track', line: line + 1 };
    } else if (callee.text === 'gtag') {
      if (args.length < 2) return undefined;
      const firstArg = args[0];
      const eventArg = args[1];
      if (firstArg && eventArg && ts.isStringLiteral(firstArg) && firstArg.text === 'event') {
        const name = readStringArg(eventArg);
        if (name !== undefined) return { name, method: 'gtag', line: line + 1 };
      }
    }
    return undefined;
  }

  if (ts.isPropertyAccessExpression(callee)) {
    const objectName = ts.isIdentifier(callee.expression)
      ? callee.expression.text
      : undefined;
    const methodName = callee.name.text;

    if (objectName === 'posthog' && methodName === 'capture') {
      const name = readStringArg(args[0]);
      if (name !== undefined) {
        return { name, method: 'posthog.capture', line: line + 1 };
      }
    }
    if (objectName === 'analytics' && methodName === 'track') {
      const name = readStringArg(args[0]);
      if (name !== undefined) {
        return { name, method: 'analytics.track', line: line + 1 };
      }
    }
  }

  return undefined;
}

function readStringArg(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}
