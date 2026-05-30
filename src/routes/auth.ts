import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { authenticate, getUserId } from "../plugins/auth.js";
import { AuthService } from "../services/auth.service.js";
import {
  errorResponseSchema,
  tokenPairSchema,
  userPublicSchema,
} from "../types/api.js";

function toTokenPairResponse(
  result: Awaited<ReturnType<AuthService["signInWithOAuth"]>>,
  accessToken: string,
) {
  return {
    accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
}

const oauthBodySchema = z.object({
  provider: z.enum(["apple", "google"]),
  idToken: z.string().min(1),
  inviteCode: z.string().optional(),
});

const magicLinkBodySchema = z.object({
  email: z.string().email(),
});

const magicLinkVerifyBodySchema = z.object({
  token: z.string().min(1),
  inviteCode: z.string().optional(),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const updateMeBodySchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const authService = new AuthService(db);

  typed.post(
    "/oauth",
    {
      schema: {
        tags: ["Auth"],
        body: oauthBodySchema,
        response: {
          200: tokenPairSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await authService.signInWithOAuth(request.body);
      const accessToken = app.jwt.sign(
        { sub: result.userId },
        { expiresIn: app.config.JWT_ACCESS_TTL },
      );
      return reply.send(toTokenPairResponse(result, accessToken));
    },
  );

  typed.post(
    "/magic-link",
    {
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Auth"],
        body: magicLinkBodySchema,
        response: {
          200: z.object({
            sent: z.literal(true),
            devToken: z.string().optional(),
          }),
          400: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const result = await authService.requestMagicLink(request.body.email);
      return { sent: true as const, devToken: result.devToken };
    },
  );

  typed.get(
    "/magic-link/verify",
    {
      schema: {
        tags: ["Auth"],
        hide: true,
        querystring: z.object({
          token: z.string().min(1),
          inviteCode: z.string().optional(),
        }),
        response: {
          302: z.null(),
        },
      },
    },
    async (request, reply) => {
      const redirectUrl = authService.buildMagicLinkCallbackUrl(
        request.query.token,
        request.query.inviteCode,
      );
      return reply.redirect(redirectUrl);
    },
  );

  typed.post(
    "/magic-link/verify",
    {
      config: { rateLimit: { max: 20, timeWindow: "15 minutes" } },
      schema: {
        tags: ["Auth"],
        body: magicLinkVerifyBodySchema,
        response: {
          200: tokenPairSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await authService.verifyMagicLink(request.body);
      const accessToken = app.jwt.sign(
        { sub: result.userId },
        { expiresIn: app.config.JWT_ACCESS_TTL },
      );
      return reply.send(toTokenPairResponse(result, accessToken));
    },
  );

  typed.post(
    "/refresh",
    {
      schema: {
        tags: ["Auth"],
        body: refreshBodySchema,
        response: {
          200: tokenPairSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await authService.refreshTokens(request.body.refreshToken);
      const accessToken = app.jwt.sign(
        { sub: result.userId },
        { expiresIn: app.config.JWT_ACCESS_TTL },
      );
      return reply.send(toTokenPairResponse(result, accessToken));
    },
  );

  typed.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        body: refreshBodySchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await authService.logout(request.body.refreshToken);
      return reply.code(204).send(null);
    },
  );

  typed.get(
    "/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Auth"],
        response: {
          200: userPublicSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => authService.getUserById(getUserId(request)),
  );

  typed.patch(
    "/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Auth"],
        body: updateMeBodySchema,
        response: {
          200: userPublicSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) =>
      authService.updateProfile(getUserId(request), request.body),
  );
}
