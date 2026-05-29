import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env, getCorsOrigins, isR2Configured } from "./lib/config.js";
import { isAppError } from "./lib/errors.js";
import { saveLocalUpload } from "./lib/storage/r2.js";
import { authRoutes } from "./routes/auth.js";
import { conversationRoutes } from "./routes/conversations.js";
import { itemRoutes } from "./routes/items.js";
import { configRoutes, healthRoutes } from "./routes/system.js";
import { matchRoutes, swipeRoutes } from "./routes/swipes.js";
import { zoneRoutes } from "./routes/zones.js";

declare module "fastify" {
  interface FastifyInstance {
    config: typeof env;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  }).withTypeProvider<ZodTypeProvider>();

  app.decorate("config", env);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  if (!isR2Configured()) {
    app.addContentTypeParser(
      /^image\/.+|application\/octet-stream$/,
      { parseAs: "buffer", bodyLimit: 10 * 1024 * 1024 },
      (_req, body, done) => done(null, body),
    );
  }

  await app.register(cors, {
    origin: getCorsOrigins(),
    credentials: true,
  });

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Ayni API",
        description: "Local barter API",
        version: "0.1.0",
      },
      servers: [{ url: env.API_BASE_URL }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "validation" in error &&
      error.validation
    ) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: error.validation,
        },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });

  if (!isR2Configured()) {
    app.put("/v1/dev-upload/*", async (request, reply) => {
      const key = decodeURIComponent(
        (request.params as { "*": string })["*"],
      );
      const data = request.body;
      if (!Buffer.isBuffer(data)) {
        return reply.status(400).send({ error: "Expected raw image body" });
      }
      saveLocalUpload(key, data);
      return reply.status(204).send();
    });
  }

  await app.register(healthRoutes);
  await app.register(configRoutes, { prefix: "/v1" });
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(itemRoutes, { prefix: "/v1/items" });
  await app.register(swipeRoutes, { prefix: "/v1/swipes" });
  await app.register(matchRoutes, { prefix: "/v1/matches" });
  await app.register(conversationRoutes, { prefix: "/v1/conversations" });
  await app.register(zoneRoutes, { prefix: "/v1/zones" });

  return app;
}
