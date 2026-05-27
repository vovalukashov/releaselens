import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { reports } from '@/lib/schema';
import { notifySlack } from '@/lib/slack';

interface PostBody {
  report: {
    passed: boolean;
    counts: { critical: number; warning: number; info: number };
    results: unknown[];
  };
  prNumber?: string | null;
  branch?: string | null;
  commit?: string | null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const project = await authenticateRequest(req);
  if (!project) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as PostBody;
  if (!body?.report) {
    return Response.json({ error: 'Missing report' }, { status: 400 });
  }

  const [inserted] = await db
    .insert(reports)
    .values({
      projectId: project.id,
      prNumber: body.prNumber ?? null,
      branch: body.branch ?? null,
      commit: body.commit ?? null,
      passed: body.report.passed,
      criticalCount: body.report.counts.critical,
      warningCount: body.report.counts.warning,
      infoCount: body.report.counts.info,
      payload: body.report,
    })
    .returning({ id: reports.id });

  if (project.slackWebhookUrl && !body.report.passed) {
    try {
      await notifySlack({
        webhookUrl: project.slackWebhookUrl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        report: body.report as any,
        projectSlug: project.slug,
        ...(body.prNumber ? { prNumber: body.prNumber } : {}),
        ...(body.branch ? { branch: body.branch } : {}),
      });
    } catch (err) {
      console.error('Slack notify failed', err);
    }
  }

  return Response.json({ id: inserted?.id }, { status: 201 });
}

export async function GET(req: NextRequest): Promise<Response> {
  const project = await authenticateRequest(req);
  if (!project) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitParam ?? 25), 1), 100);

  const rows = await db
    .select({
      id: reports.id,
      prNumber: reports.prNumber,
      branch: reports.branch,
      commit: reports.commit,
      passed: reports.passed,
      criticalCount: reports.criticalCount,
      warningCount: reports.warningCount,
      infoCount: reports.infoCount,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.projectId, project.id))
    .orderBy(desc(reports.createdAt))
    .limit(limit);

  return Response.json({ reports: rows });
}
