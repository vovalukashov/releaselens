import type { CheckResult, RunReport, Severity } from '@releaselens/core';

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
};

export function markdownReport(
  report: RunReport,
  configPath: string,
): string {
  const lines: string[] = [];
  lines.push('# ReleaseLens Report');
  lines.push('');
  lines.push(`**Config:** \`${configPath}\``);
  lines.push('');
  lines.push(
    `**Status:** ${report.passed ? '✅ PASSED' : '❌ FAILED'}`,
  );
  lines.push('');
  lines.push(
    `**Summary:** ${report.counts.critical} critical · ${report.counts.warning} warnings · ${report.counts.info} info`,
  );
  lines.push('');

  if (report.results.length === 0) {
    lines.push('_No findings._');
    lines.push('');
    return lines.join('\n');
  }

  const grouped = groupByTarget(report.results);
  for (const [key, items] of grouped) {
    lines.push(`## ${escapeMarkdown(key)}`);
    lines.push('');
    for (const r of items) {
      const loc = r.locale ? ` \`${r.locale}\`` : '';
      const conf =
        r.confidence === 'low' ? ' _(low confidence)_' : '';
      lines.push(
        `- ${SEVERITY_BADGE[r.severity]} **${SEVERITY_LABEL[r.severity]}** · \`${r.checkId}\`${loc}${conf} — ${escapeMarkdown(r.message)}`,
      );
      if (r.explanation) {
        const collapsed = r.explanation
          .split('\n')
          .map((line) => `  > ${escapeMarkdown(line)}`)
          .join('\n');
        lines.push(`  <details><summary>AI explanation</summary>\n\n${collapsed}\n\n  </details>`);
      } else if (r.explanationError) {
        lines.push(`  > _AI: ${escapeMarkdown(r.explanationError)}_`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function groupByTarget(results: CheckResult[]): Map<string, CheckResult[]> {
  const map = new Map<string, CheckResult[]>();
  for (const r of results) {
    const key = r.route ?? r.form ?? r.event ?? '(global)';
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}
