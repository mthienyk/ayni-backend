import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { authenticate, getUserId } from "../plugins/auth.js";
import { ZoneService } from "../services/zone.service.js";

export async function zoneRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const zoneService = new ZoneService(db);

  typed.get(
    "/nearby",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Zones"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          lat: z.coerce.number().min(-90).max(90).optional(),
          lng: z.coerce.number().min(-180).max(180).optional(),
        }),
        response: {
          200: z.object({
            zone: z
              .object({
                id: z.string().uuid(),
                name: z.string(),
                h3Index: z.string().nullable(),
                currentUserCount: z.number(),
                threshold: z.number(),
                isUnlocked: z.boolean(),
                thresholdUnlockedAt: z.string().nullable(),
              })
              .nullable(),
            userCountInZone: z.number(),
          }),
        },
      },
    },
    async (request) => {
      const location =
        request.query.lat !== undefined && request.query.lng !== undefined
          ? { lat: request.query.lat, lng: request.query.lng }
          : undefined;
      return zoneService.getNearby(getUserId(request), location);
    },
  );
}
