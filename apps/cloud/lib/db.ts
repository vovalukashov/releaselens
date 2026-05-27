import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | null = null;

function init(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL env var is required. Add Neon Postgres via Vercel Marketplace integration.',
    );
  }
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as Db, {
  get(_, prop) {
    if (!cached) cached = init();
    return Reflect.get(cached, prop);
  },
});
