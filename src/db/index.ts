import fs from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function isSqlConfigured(): boolean {
  const host = (process.env.SQL_HOST || '').trim();
  if (
    !host ||
    !process.env.SQL_USER ||
    !process.env.SQL_PASSWORD ||
    !process.env.SQL_DB_NAME
  ) {
    return false;
  }

  // When running with a Cloud SQL Unix socket path, verify the socket actually exists.
  if (host.startsWith('/')) {
    return fs.existsSync(path.join(host, '.s.PGSQL.5432'));
  }

  return true;
}

export const createPool = (): Pool => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
