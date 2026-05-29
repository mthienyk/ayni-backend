import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db/index.js";
import { authenticate, getUserId } from "../plugins/auth.js";
import { ItemService } from "../services/item.service.js";

const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const itemSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  status: z.string(),
  location: geoPointSchema.nullable(),
  zoneId: z.string().uuid().nullable(),
  aiMetadata: z.record(z.string(), z.unknown()).nullable(),
  photos: z.array(
    z.object({
      id: z.string().uuid(),
      url: z.string(),
      thumbnailUrl: z.string().nullable(),
      orderIndex: z.number(),
      isPrimary: z.boolean(),
      moderationStatus: z.string(),
    }),
  ),
  createdAt: z.string(),
});

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const itemService = new ItemService(db);

  typed.post(
    "/",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        body: z.object({
          zoneId: z.string().uuid().optional(),
          location: geoPointSchema.optional(),
        }),
        response: { 201: itemSchema },
      },
    },
    async (request, reply) => {
      const item = await itemService.createDraft(getUserId(request), request.body);
      return reply.status(201).send(item);
    },
  );

  typed.get(
    "/feed",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          limit: z.coerce.number().optional(),
          cursor: z.string().optional(),
        }),
        response: {
          200: z.object({
            items: z.array(itemSchema),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (request) => itemService.getFeed(getUserId(request), request.query),
  );

  typed.get(
    "/:id",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: { 200: itemSchema },
      },
    },
    async (request) =>
      itemService.getById(request.params.id, getUserId(request)),
  );

  typed.patch(
    "/:id",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          title: z.string().min(1).max(120).optional(),
          description: z.string().max(1000).optional(),
          priceMin: z.number().int().min(0).optional(),
          priceMax: z.number().int().min(0).optional(),
          location: geoPointSchema.optional(),
          zoneId: z.string().uuid().optional(),
        }),
        response: { 200: itemSchema },
      },
    },
    async (request) =>
      itemService.updateItem(getUserId(request), request.params.id, request.body),
  );

  typed.post(
    "/:id/publish",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        response: { 200: itemSchema },
      },
    },
    async (request) =>
      itemService.publish(getUserId(request), request.params.id),
  );

  typed.post(
    "/:id/photos/presign",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          filename: z.string().min(1),
          contentType: z.string().min(1),
        }),
        response: {
          200: z.object({
            uploadUrl: z.string().url(),
            storageKey: z.string(),
            expiresIn: z.number(),
          }),
        },
      },
    },
    async (request) =>
      itemService.presignPhotoUpload(
        getUserId(request),
        request.params.id,
        request.body,
      ),
  );

  typed.post(
    "/:id/photos/confirm",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          storageKey: z.string().min(1),
          contentType: z.string().min(1),
          isPrimary: z.boolean().optional(),
        }),
        response: { 200: itemSchema },
      },
    },
    async (request) =>
      itemService.confirmPhotoUpload(
        getUserId(request),
        request.params.id,
        request.body,
      ),
  );
}
