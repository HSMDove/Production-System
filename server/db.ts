import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Pool as PgPool } from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

type DatabaseInitConfig = {
  connectionString: string;
  useNeonSsl: boolean;
};

let internalPool: PgPool | null = null;
let internalDb: NodePgDatabase<typeof schema> | null = null;

export function initializeDatabase(config: DatabaseInitConfig) {
  if (internalPool && internalDb) return;

  internalPool = new Pool({
    connectionString: config.connectionString,
    ssl: config.useNeonSsl ? { rejectUnauthorized: false } : undefined,
  });
  internalDb = drizzle(internalPool, { schema });
}

export function getPool(): PgPool {
  if (!internalPool) {
    throw new Error("Database pool is not initialized. Call initializeDatabase() during startup.");
  }
  return internalPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!internalDb) {
    throw new Error("Database client is not initialized. Call initializeDatabase() during startup.");
  }
  return internalDb;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const activeDb = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = activeDb[prop];

    if (typeof value !== "function") {
      return value;
    }

    return (...args: unknown[]) =>
      (value as (...fnArgs: unknown[]) => unknown).apply(activeDb, args);
  },
}) as NodePgDatabase<typeof schema>;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function checkDatabaseReady(timeoutMs = 2000) {
  await withTimeout(
    getPool().query("select 1"),
    timeoutMs,
    `Database readiness check timed out after ${timeoutMs}ms`,
  );
}

export async function ensureIntegrationTables() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS integration_channels (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform text NOT NULL,
      name text NOT NULL,
      credentials jsonb NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS folder_channel_mappings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_id varchar NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      integration_channel_id varchar NOT NULL REFERENCES integration_channels(id) ON DELETE CASCADE,
      target_id text NOT NULL,
      created_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS release_notes (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      version text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      emoji text DEFAULT '🚀',
      is_published boolean NOT NULL DEFAULT false,
      published_at timestamp,
      created_at timestamp NOT NULL DEFAULT NOW(),
      updated_at timestamp NOT NULL DEFAULT NOW()
    );
  `);
}
