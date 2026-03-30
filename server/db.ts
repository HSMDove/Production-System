import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString, ssl: process.env.NEON_DATABASE_URL ? { rejectUnauthorized: false } : undefined });
export const db = drizzle(pool, { schema });

export async function ensureIntegrationTables() {
  await pool.query(`
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
