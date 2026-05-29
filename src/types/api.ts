import { z } from "zod";

export const userPublicSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  email: z.string().nullable(),
  inviteCode: z.string(),
  needsDisplayName: z.boolean(),
  createdAt: z.string().datetime(),
});

export type UserPublic = z.infer<typeof userPublicSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userPublicSchema,
});

export type TokenPair = z.infer<typeof tokenPairSchema>;

export type TokenPairResponse = TokenPair & { userId: string };

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const configResponseSchema = z.object({
  minSupportedVersion: z.string(),
  inviteBaseUrl: z.string().url(),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const readyResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.boolean(),
  postgis: z.boolean(),
});
