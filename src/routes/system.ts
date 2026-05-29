import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { checkDatabaseReady } from "../db/index.js";
import {
  healthResponseSchema,
  readyResponseSchema,
} from "../types/api.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        response: { 200: healthResponseSchema },
      },
    },
    async () => ({ status: "ok" as const }),
  );

  typed.get(
    "/ready",
    {
      schema: {
        tags: ["System"],
        response: { 200: readyResponseSchema },
      },
    },
    async () => {
      const ready = await checkDatabaseReady();
      return {
        status: ready ? ("ok" as const) : ("degraded" as const),
        database: ready,
        postgis: ready,
      };
    },
  );
}

export async function configRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/config",
    {
      schema: {
        tags: ["System"],
        response: {
          200: z.object({
            minSupportedVersion: z.string(),
            inviteBaseUrl: z.string().url(),
          }),
        },
      },
    },
    async () => ({
      minSupportedVersion: app.config.MIN_SUPPORTED_APP_VERSION,
      inviteBaseUrl: app.config.INVITE_BASE_URL,
    }),
  );
}
