import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { authenticate, getUserId } from "../plugins/auth.js";
import { MatchService, SwipeService } from "../services/swipe.service.js";

const swipeSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  direction: z.enum(["like", "pass"]),
  createdAt: z.string(),
  matchId: z.string().uuid().nullable(),
});

const matchSchema = z.object({
  id: z.string().uuid(),
  itemAId: z.string().uuid(),
  itemBId: z.string().uuid(),
  userAId: z.string().uuid(),
  userBId: z.string().uuid(),
  status: z.string(),
  conversationId: z.string().uuid().nullable(),
  createdAt: z.string(),
});

export async function swipeRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const matchService = new MatchService(db);
  const swipeService = new SwipeService(db, matchService);

  typed.post(
    "/",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Swipes"],
        security: [{ bearerAuth: [] }],
        body: z.object({
          itemId: z.string().uuid(),
          direction: z.enum(["like", "pass"]),
        }),
        response: {
          200: z.object({
            swipe: swipeSchema,
            match: matchSchema.nullable(),
          }),
        },
      },
    },
    async (request) => swipeService.swipe(getUserId(request), request.body),
  );

  typed.get(
    "/",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Swipes"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          limit: z.coerce.number().optional(),
          cursor: z.string().optional(),
        }),
        response: {
          200: z.object({
            swipes: z.array(swipeSchema),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (request) =>
      swipeService.listHistory(getUserId(request), request.query),
  );
}

export async function matchRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const matchService = new MatchService(db);

  typed.get(
    "/",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Matches"],
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ matches: z.array(matchSchema) }) },
      },
    },
    async (request) => ({
      matches: await matchService.listForUser(getUserId(request)),
    }),
  );
}
