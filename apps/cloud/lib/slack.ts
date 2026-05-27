import type { RunReport } from '@releaselens/core';

export interface NotifyOptions {
  webhookUrl: string;
  report: RunReport;
  projectSlug: string;
  prNumber?: string;
  branch?: string;
  reportUrl?: string;
}

export async function notifySlack(opts: NotifyOptions): Promise<void> {
  const blocks = buildBlocks(opts);
  await fetch(opts.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
}

function buildBlocks(opts: NotifyOptions): unknown[] {
  const { report, projectSlug, prNumber, branch, reportUrl } = opts;
  const title = report.passed
    ? `:white_check_mark: ReleaseLens passed — ${projectSlug}`
    : `:x: ReleaseLens failed — ${projectSlug}`;
  const subtitle = [
    prNumber ? `PR #${prNumber}` : null,
    branch ? `branch \`${branch}\`` : null,
    `${report.counts.critical} critical · ${report.counts.warning} warnings · ${report.counts.info} info`,
  ]
    .filter(Boolean)
    .join(' · ');

  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: title } },
    { type: 'section', text: { type: 'mrkdwn', text: subtitle } },
  ];

  const findings = report.results
    .filter((r) => r.severity === 'critical')
    .slice(0, 5);

  if (findings.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: findings
          .map(
            (f) =>
              `• \`${f.checkId}\` — ${f.message}${f.route ? ` (${f.route})` : ''}`,
          )
          .join('\n'),
      },
    });
  }

  if (reportUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open report' },
          url: reportUrl,
        },
      ],
    });
  }

  return blocks;
}
