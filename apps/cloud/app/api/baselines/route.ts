import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { baselines } from '@/lib/schema';

interface PostBody {
  fingerprints: string[];
}

export async function POST(req: NextRequest): Promise<Response> {
  const project = await authenticateRequest(req);
  if (!project) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as PostBody;
  if (!Array.isArray(body?.fingerprints)) {
    return Response.json({ error: 'Missing fingerprints[]' }, { status: 400 });
  }

  await db
    .insert(baselines)
    .values({ projectId: project.id, fingerprints: body.fingerprints })
    .onConflictDoUpdate({
      target: baselines.projectId,
      set: { fingerprints: body.fingerprints, updatedAt: new Date() },
    });

  return Response.json(
    { count: body.fingerprints.length },
    { status: 200 },
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const project = await authenticateRequest(req);
  if (!project) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseline = await db.query.baselines.findFirst({
    where: eq(baselines.projectId, project.id),
  });

  return Response.json({
    fingerprints: baseline?.fingerprints ?? [],
    updatedAt: baseline?.updatedAt ?? null,
  });
}
