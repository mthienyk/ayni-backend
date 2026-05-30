import "dotenv/config";
import { writeFileSync } from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { magicLinkTokens } from "../src/db/schema/index.js";
import {
  generateSecureToken,
  hashToken,
  hashTokenLookup,
  normalizeEmail,
} from "../src/lib/crypto.js";
import { env } from "../src/lib/config.js";

const emailArg = process.argv[2];
const apiFlagIndex = process.argv.indexOf("--api");
const apiBase =
  apiFlagIndex >= 0 ? process.argv[apiFlagIndex + 1] : env.API_BASE_URL;
const sessionPath =
  process.argv.includes("--save") || !process.argv.includes("--no-save")
    ? ".ayni-session.json"
    : null;

if (!emailArg) {
  console.error(
    "Usage: pnpm exec tsx scripts/bootstrap-session.ts <email> [--api URL]",
  );
  process.exit(1);
}

async function createMagicLinkToken(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const token = generateSecureToken();
  const lookupHash = hashTokenLookup(token);
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(
    Date.now() + env.MAGIC_LINK_TTL_MINUTES * 60_000,
  );

  await db
    .update(magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(magicLinkTokens.email, normalized),
        isNull(magicLinkTokens.consumedAt),
      ),
    );

  await db.insert(magicLinkTokens).values({
    email: normalized,
    lookupHash,
    tokenHash,
    expiresAt,
  });

  return token;
}

async function verifyToken(token: string) {
  const response = await fetch(`${apiBase}/v1/auth/magic-link/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`verify failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function patchDisplayName(
  accessToken: string,
  displayName: string,
): Promise<void> {
  const response = await fetch(`${apiBase}/v1/auth/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`profile update failed (${response.status}): ${body}`);
  }
}

async function main(): Promise<void> {
  const email = normalizeEmail(emailArg);
  const displayName = process.argv.includes("--name")
    ? process.argv[process.argv.indexOf("--name") + 1]
    : undefined;

  console.info(`Bootstrapping session for ${email} via ${apiBase}...`);

  const token = await createMagicLinkToken(email);
  const session = await verifyToken(token);

  if (displayName && session.user?.needsDisplayName) {
    await patchDisplayName(session.accessToken, displayName);
    session.user.displayName = displayName;
    session.user.needsDisplayName = false;
  }

  const payload = {
    email,
    apiBaseUrl: apiBase,
    createdAt: new Date().toISOString(),
    ...session,
  };

  console.info("\nSession ready:\n");
  console.info(JSON.stringify(payload, null, 2));

  if (sessionPath) {
    writeFileSync(sessionPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.info(`\nSaved to ${sessionPath} (gitignored).`);
  }

  console.info(
    `\ncurl ${apiBase}/v1/auth/me -H "Authorization: Bearer ${session.accessToken}"`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
