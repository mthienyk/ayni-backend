import { hash, verify } from "@node-rs/argon2";
import { nanoid } from "nanoid";

export async function hashToken(token: string): Promise<string> {
  return hash(token, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
}

export async function verifyTokenHash(
  token: string,
  tokenHash: string,
): Promise<boolean> {
  return verify(tokenHash, token);
}

export function generateSecureToken(): string {
  return nanoid(48);
}

export function generateInviteCode(): string {
  return nanoid(10);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canonicalItemPair(
  itemAId: string,
  itemBId: string,
): { itemLowId: string; itemHighId: string } {
  return itemAId < itemBId
    ? { itemLowId: itemAId, itemHighId: itemBId }
    : { itemLowId: itemBId, itemHighId: itemAId };
}
