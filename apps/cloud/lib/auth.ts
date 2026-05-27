import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { projects, type Project } from './schema';

export function generateApiToken(): string {
  return `rl_${randomBytes(24).toString('hex')}`;
}

export async function authenticateRequest(
  req: Request,
): Promise<Project | null> {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const project = await db.query.projects.findFirst({
    where: eq(projects.apiToken, token),
  });
  return project ?? null;
}
