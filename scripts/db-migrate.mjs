import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const JOURNAL_PATH = "src/db/migrations/meta/_journal.json";
const SCHEMA_PROBE = "public.users";

function readJournal() {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
  return journal.entries.map((entry) => ({
    tag: entry.tag,
    when: entry.when,
    file: `src/db/migrations/${entry.tag}.sql`,
  }));
}

function migrationHash(filePath) {
  return createHash("sha256").update(readFileSync(filePath, "utf8")).digest("hex");
}

function runDrizzleMigrate() {
  const result = spawnSync("pnpm", ["run", "db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

async function baselineMissingMigrations(sql, entries) {
  const applied = await sql`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;
  const appliedHashes = new Set(applied.map((row) => row.hash));
  const schemaReady =
    (await sql`SELECT to_regclass(${SCHEMA_PROBE}) AS reg`)[0]?.reg !== null;

  if (!schemaReady) {
    return false;
  }

  let inserted = false;
  for (const entry of entries) {
    const hash = migrationHash(entry.file);
    if (appliedHashes.has(hash)) {
      continue;
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.warn(
      `[db-migrate] Baselined ${entry.tag}: schema exists but migration journal was missing.`,
    );
    inserted = true;
  }
  return inserted;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[db-migrate] DATABASE_URL is required.");
    process.exit(1);
  }

  const entries = readJournal();
  let status = runDrizzleMigrate();
  if (status === 0) {
    process.exit(0);
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const baselined = await baselineMissingMigrations(sql, entries);
    if (!baselined) {
      process.exit(status);
    }
  } finally {
    await sql.end();
  }

  status = runDrizzleMigrate();
  process.exit(status);
}

main().catch((error) => {
  console.error("[db-migrate] Unexpected error:", error);
  process.exit(1);
});
