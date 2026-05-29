import { lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { magicLinkTokens, refreshTokens } from "../db/schema/index.js";
import { ZoneService } from "../services/zone.service.js";

export async function runZoneStats(): Promise<number> {
  const service = new ZoneService(db);
  return service.recomputeZoneStats();
}

export async function runExpireMagicLinks(): Promise<number> {
  const result = await db
    .delete(magicLinkTokens)
    .where(lt(magicLinkTokens.expiresAt, new Date()))
    .returning({ id: magicLinkTokens.id });
  return result.length;
}

export async function runRefreshTokenPrune(): Promise<number> {
  const result = await db
    .delete(refreshTokens)
    .where(
      sql`${refreshTokens.expiresAt} < NOW() OR ${refreshTokens.revokedAt} IS NOT NULL`,
    )
    .returning({ id: refreshTokens.id });
  return result.length;
}

const jobs: Record<string, () => Promise<number>> = {
  "zone-stats": runZoneStats,
  "expire-magic-links": runExpireMagicLinks,
  "refresh-token-prune": runRefreshTokenPrune,
};

async function main(): Promise<void> {
  const jobName = process.argv[2];
  if (!jobName || !jobs[jobName]) {
    console.error(`Usage: tsx src/jobs/run.ts <${Object.keys(jobs).join("|")}>`);
    process.exit(1);
  }

  const count = await jobs[jobName]();
  console.info(`Job ${jobName} completed (${count} rows affected)`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
