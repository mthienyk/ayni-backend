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
import { env, getCorsOrigins } from "./lib/config.js";
import { isAppError } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { configRoutes, healthRoutes } from "./routes/system.js";

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

  await app.register(healthRoutes);
  await app.register(configRoutes, { prefix: "/v1" });
  await app.register(authRoutes, { prefix: "/v1/auth" });

  return app;
}
