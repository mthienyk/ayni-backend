import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/config.js";
import * as schema from "./schema/index.js";

const client = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(client, { schema });

export type Database = typeof db;

export async function checkDatabaseReady(): Promise<boolean> {
  try {
    const result = await client<{ ok: number }[]>`
      SELECT 1 AS ok
      WHERE EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'postgis'
      )
    `;
    return result.length > 0 && result[0].ok === 1;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await client.end();
}
