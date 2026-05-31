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
    lines.push(`## ${escapeHeading(key)}`);
    lines.push('');
    for (const r of items) {
      const loc = r.locale ? ` \`${r.locale}\`` : '';
      const conf =
        r.confidence === 'low' ? ' _(low confidence)_' : '';
      lines.push(
        `- ${SEVERITY_BADGE[r.severity]} **${SEVERITY_LABEL[r.severity]}** · \`${r.checkId}\`${loc}${conf} — ${renderInline(r.message)}`,
      );
      if (r.explanation) {
        const collapsed = r.explanation
          .split('\n')
          .map((line) => `  > ${renderInline(line)}`)
          .join('\n');
        lines.push(`  <details><summary>AI explanation</summary>\n\n${collapsed}\n\n  </details>`);
      } else if (r.explanationError) {
        lines.push(`  > _AI: ${renderInline(r.explanationError)}_`);
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

/**
 * Render a message line for GFM. Preserves backtick code-spans verbatim and
 * applies a minimal escape (`\`, `*`, `_`, `<`, `>`, `|`) to the surrounding
 * plain text. Avoids the brute-force escape that turned `\`metadata.canonical\``
 * into `` \`metadata\.canonical\` `` in rendered output.
 */
function renderInline(text: string): string {
  const parts = text.split(/(`[^`]*`)/g);
  return parts
    .map((part) =>
      part.length >= 2 && part.startsWith('`') && part.endsWith('`')
        ? part
        : escapeInlinePlain(part),
    )
    .join('');
}

function escapeInlinePlain(text: string): string {
  return text.replace(/([\\*_<>|])/g, '\\$1');
}

function escapeHeading(text: string): string {
  return text.replace(/([\\*_])/g, '\\$1');
}
