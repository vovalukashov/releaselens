import type { CheckResult, RunReport, Severity } from '@releaselens/core';
import pc from 'picocolors';

const SEVERITY_ICON: Record<Severity, string> = {
  critical: pc.red('x'),
  warning: pc.yellow('!'),
  info: pc.cyan('i'),
};

export function textReport(report: RunReport, configPath: string): string {
  const lines: string[] = [];
  lines.push(`${pc.bold('releaselens')} ${pc.dim(`(config: ${configPath})`)}`);
  lines.push('');

  if (report.results.length === 0) {
    lines.push(pc.green('All checks passed. Nothing to report.'));
    lines.push('');
    return lines.join('\n');
  }

  const grouped = groupByRoute(report.results);
  for (const [routeKey, items] of grouped) {
    lines.push(pc.underline(routeKey));
    for (const r of items) {
      const loc = r.locale ? pc.dim(` [${r.locale}]`) : '';
      const conf = r.confidence === 'low' ? pc.dim(` (low confidence)`) : '';
      lines.push(
        `  ${SEVERITY_ICON[r.severity]} ${pc.dim(r.checkId)}${loc}${conf} ${r.message}`,
      );
      if (r.explanation) {
        for (const explainLine of r.explanation.split('\n')) {
          lines.push(`      ${pc.dim('AI:')} ${pc.dim(explainLine)}`);
        }
      } else if (r.explanationError) {
        lines.push(`      ${pc.dim(`AI: ${r.explanationError}`)}`);
      }
    }
    lines.push('');
  }

  lines.push(
    `${pc.bold('Summary')}: ${pc.red(`${report.counts.critical} critical`)}, ${pc.yellow(`${report.counts.warning} warnings`)}, ${pc.cyan(`${report.counts.info} info`)}.`,
  );
  lines.push(
    report.passed ? pc.green('Status: PASSED') : pc.red('Status: FAILED'),
  );
  lines.push('');
  return lines.join('\n');
}

function groupByRoute(results: CheckResult[]): Map<string, CheckResult[]> {
  const map = new Map<string, CheckResult[]>();
  for (const r of results) {
    const key = r.route ?? r.form ?? r.event ?? '(global)';
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}
