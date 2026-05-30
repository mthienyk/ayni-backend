#!/usr/bin/env node
/**
 * Dev-only login helper (no client app required).
 *
 * Usage:
 *   pnpm dev:login you@example.com
 *   pnpm dev:login you@example.com --api https://ayni-backend-production-d824.up.railway.app
 *   pnpm dev:login you@example.com --token PASTE_FROM_EMAIL
 */

import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const email = args.find((arg) => !arg.startsWith("--"));
const apiFlagIndex = args.indexOf("--api");
const apiBase =
  apiFlagIndex >= 0 ? args[apiFlagIndex + 1] : "http://localhost:3000";
const tokenFlagIndex = args.indexOf("--token");
const manualToken = tokenFlagIndex >= 0 ? args[tokenFlagIndex + 1] : undefined;
const nameFlagIndex = args.indexOf("--name");
const displayName = nameFlagIndex >= 0 ? args[nameFlagIndex + 1] : undefined;
const saveSession = !args.includes("--no-save");

if (!email) {
  console.error("Usage: pnpm dev:login <email> [--api URL] [--token TOKEN]");
  process.exit(1);
}

async function requestMagicLink() {
  const response = await fetch(`${apiBase}/v1/auth/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`magic-link failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function verifyToken(token) {
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

async function patchDisplayName(accessToken, name) {
  const response = await fetch(`${apiBase}/v1/auth/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName: name }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`profile update failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function main() {
  let token = manualToken;

  if (!token) {
    console.info(`Requesting magic link for ${email} on ${apiBase}...`);
    const sent = await requestMagicLink();

    if (sent.devToken) {
      token = sent.devToken;
      console.info("Dev token received from API (DEV_AUTH_EXPOSE_TOKEN=true).");
    } else {
      console.info("Magic link sent. Options:");
      console.info("  1. Check your email and run:");
      console.info(`     pnpm dev:login ${email} --token TOKEN --api ${apiBase}`);
      console.info("  2. Or check the pnpm dev server logs for [dev:auth] curl command.");
      process.exit(0);
    }
  }

  let session = await verifyToken(token);

  if (displayName && session.user?.needsDisplayName) {
    session.user = await patchDisplayName(session.accessToken, displayName);
  }

  const payload = {
    email,
    apiBaseUrl: apiBase,
    createdAt: new Date().toISOString(),
    ...session,
  };

  console.info("\nLogged in successfully.\n");
  console.info(JSON.stringify(payload, null, 2));

  if (saveSession) {
    writeFileSync(".ayni-session.json", `${JSON.stringify(payload, null, 2)}\n`);
    console.info("\nSaved to .ayni-session.json (gitignored).");
  }

  console.info("\nQuick test:");
  console.info(
    `curl ${apiBase}/v1/auth/me -H "Authorization: Bearer ${session.accessToken}"`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
