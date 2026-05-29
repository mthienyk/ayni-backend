import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { authenticate, getUserId } from "../plugins/auth.js";
import { ConversationService } from "../services/conversation.service.js";

const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

export async function conversationRoutes(
  app: FastifyInstance,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const conversationService = new ConversationService(db);

  typed.get(
    "/:id/messages",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Conversations"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        querystring: z.object({
          since: z.string().datetime().optional(),
          limit: z.coerce.number().optional(),
        }),
        response: {
          200: z.object({ messages: z.array(messageSchema) }),
        },
      },
    },
    async (request) =>
      conversationService.listMessages(
        getUserId(request),
        request.params.id,
        request.query,
      ),
  );

  typed.post(
    "/:id/messages",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Conversations"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ body: z.string().min(1).max(2000) }),
        response: { 201: messageSchema },
      },
    },
    async (request, reply) => {
      const message = await conversationService.sendMessage(
        getUserId(request),
        request.params.id,
        request.body.body,
      );
      return reply.status(201).send(message);
    },
  );

  typed.get(
    "/by-match/:matchId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Conversations"],
        security: [{ bearerAuth: [] }],
        params: z.object({ matchId: z.string().uuid() }),
        response: { 200: z.object({ conversationId: z.string().uuid() }) },
      },
    },
    async (request) => ({
      conversationId: await conversationService.getByMatchId(
        getUserId(request),
        request.params.matchId,
      ),
    }),
  );
}
