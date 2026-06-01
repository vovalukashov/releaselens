import ts from 'typescript';

export interface TrackingCall {
  name: string;
  method: string;
  line: number;
}

const DEFAULT_TRACKERS = [
  'track',
  'posthog.capture',
  'analytics.track',
  'gtag:event',
];

interface TrackerSpec {
  /** Original spec string, surfaced as `method` on the call. */
  raw: string;
  /** Dotted callee path — `['mixpanel','track']` or `['sendEvent']`. */
  path: string[];
  /** Index of the argument that holds the event name — or the object carrying `nameProp` (default 0). */
  nameArgIndex: number;
  /** If set, the event name is read from this property of the object-literal argument at `nameArgIndex` (e.g. `eventName` for `sendEvent({ eventName: 'x' })`). */
  nameProp?: string;
  /** If set, the call's first argument must equal this string literal (e.g. `'event'` for gtag). */
  requireFirstArg?: string;
}

/**
 * Spec grammar:
 *   `<callee>`              — name at arg 0
 *   `<callee>@<n>`          — name at arg n
 *   `<callee>:<value>`      — name at arg 1; arg 0 must equal `<value>` (gtag-style)
 *   `<callee>#<prop>`       — name read from property `<prop>` of the object at arg 0
 *   `<callee>@<n>#<prop>`   — object at arg n
 *   `<callee>:<value>@<n>`  — combined
 * `<callee>` may be dotted (`mixpanel.track`, `window.dataLayer.push`).
 */
function parseSpec(raw: string): TrackerSpec | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let work = trimmed;

  let nameProp: string | undefined;
  const hashIdx = work.lastIndexOf('#');
  if (hashIdx >= 0) {
    const propStr = work.slice(hashIdx + 1).trim();
    if (propStr) {
      nameProp = propStr;
      work = work.slice(0, hashIdx);
    }
  }

  let nameArgIndex: number | undefined;
  const atIdx = work.lastIndexOf('@');
  if (atIdx >= 0) {
    const idxStr = work.slice(atIdx + 1).trim();
    const parsed = Number.parseInt(idxStr, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && String(parsed) === idxStr) {
      nameArgIndex = parsed;
      work = work.slice(0, atIdx);
    }
  }

  let requireFirstArg: string | undefined;
  const colonIdx = work.indexOf(':');
  if (colonIdx >= 0) {
    const calleeRaw = work.slice(0, colonIdx);
    const remainder = work.slice(colonIdx + 1).trim();
    if (!calleeRaw || !remainder) return undefined;
    requireFirstArg = remainder;
    work = calleeRaw;
    if (nameArgIndex === undefined && nameProp === undefined) nameArgIndex = 1;
  }

  if (nameArgIndex === undefined) nameArgIndex = 0;

  const path = work.split('.').map((p) => p.trim()).filter(Boolean);
  if (path.length === 0) return undefined;
  return {
    raw: trimmed,
    path,
    nameArgIndex,
    ...(nameProp !== undefined ? { nameProp } : {}),
    ...(requireFirstArg !== undefined ? { requireFirstArg } : {}),
  };
}

export function parseTrackingCalls(
  source: string,
  fileName = 'virtual.tsx',
  extraTrackers: string[] = [],
): TrackingCall[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  const specs: TrackerSpec[] = [];
  const seenRaw = new Set<string>();
  for (const raw of [...DEFAULT_TRACKERS, ...extraTrackers]) {
    if (seenRaw.has(raw)) continue;
    seenRaw.add(raw);
    const spec = parseSpec(raw);
    if (spec) specs.push(spec);
  }

  const calls: TrackingCall[] = [];
  visit(sf);
  return calls;

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const call = extractTrackingCall(node, sf, specs);
      if (call) calls.push(call);
    }
    ts.forEachChild(node, visit);
  }
}

function extractTrackingCall(
  node: ts.CallExpression,
  sf: ts.SourceFile,
  specs: TrackerSpec[],
): TrackingCall | undefined {
  const calleePath = getCalleePath(node.expression);
  if (!calleePath) return undefined;
  const args = node.arguments;
  if (args.length === 0) return undefined;

  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));

  for (const spec of specs) {
    if (!arraysEqual(spec.path, calleePath)) continue;
    if (spec.requireFirstArg !== undefined) {
      const firstArg = args[0];
      if (
        !firstArg ||
        !ts.isStringLiteral(firstArg) ||
        firstArg.text !== spec.requireFirstArg
      ) {
        continue;
      }
    }
    const arg = args[spec.nameArgIndex];
    const name =
      spec.nameProp !== undefined
        ? readObjectPropString(arg, spec.nameProp)
        : readStringArg(arg);
    if (name === undefined) continue;
    return { name, method: spec.raw, line: line + 1 };
  }

  return undefined;
}

function getCalleePath(callee: ts.Expression): string[] | undefined {
  if (ts.isIdentifier(callee)) return [callee.text];
  if (ts.isPropertyAccessExpression(callee)) {
    const inner = getCalleePath(callee.expression);
    if (!inner) return undefined;
    return [...inner, callee.name.text];
  }
  return undefined;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function readStringArg(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function readObjectPropString(
  node: ts.Expression | undefined,
  prop: string,
): string | undefined {
  if (!node || !ts.isObjectLiteralExpression(node)) return undefined;
  for (const member of node.properties) {
    if (!ts.isPropertyAssignment(member)) continue;
    const key = ts.isIdentifier(member.name)
      ? member.name.text
      : ts.isStringLiteral(member.name)
        ? member.name.text
        : undefined;
    if (key === prop) return readStringArg(member.initializer);
  }
  return undefined;
}
