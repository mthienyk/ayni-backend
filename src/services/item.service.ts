import { and, desc, eq, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import sharp from "sharp";
import type { Database } from "../db/index.js";
import { itemPhotos, items, swipes } from "../db/schema/index.js";
import { enrichItemFromImage } from "../lib/ai/enrich.js";
import { env } from "../lib/config.js";
import { AppError } from "../lib/errors.js";
import {
  buildObjectKey,
  createPresignedUploadUrl,
  getObjectBuffer,
  publicUrlForKey,
  putObjectBuffer,
} from "../lib/storage/r2.js";
import type { GeoPoint } from "../db/schema/geo.js";
import { geoPointFromColumns } from "../db/schema/geo.js";

export type ItemPhotoDto = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  orderIndex: number;
  isPrimary: boolean;
  moderationStatus: string;
};

export type ItemDto = {
  id: string;
  ownerId: string;
  title: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  status: string;
  location: GeoPoint | null;
  zoneId: string | null;
  aiMetadata: Record<string, unknown> | null;
  photos: ItemPhotoDto[];
  createdAt: string;
};

function toItemDto(
  item: typeof items.$inferSelect,
  photos: (typeof itemPhotos.$inferSelect)[],
): ItemDto {
  return {
    id: item.id,
    ownerId: item.ownerId,
    title: item.title,
    description: item.description,
    priceMin: item.priceMin,
    priceMax: item.priceMax,
    status: item.status,
    location: geoPointFromColumns(item.locationLng, item.locationLat),
    zoneId: item.zoneId,
    aiMetadata: item.aiMetadata ?? null,
    photos: photos.map((p) => ({
      id: p.id,
      url: p.url,
      thumbnailUrl: p.thumbnailUrl,
      orderIndex: p.orderIndex,
      isPrimary: p.isPrimary,
      moderationStatus: p.moderationStatus,
    })),
    createdAt: item.createdAt.toISOString(),
  };
}

export class ItemService {
  constructor(private readonly db: Database) {}

  async createDraft(
    userId: string,
    input: { zoneId?: string; location?: GeoPoint },
  ): Promise<ItemDto> {
    const [item] = await this.db
      .insert(items)
      .values({
        ownerId: userId,
        zoneId: input.zoneId,
        locationLat: input.location?.lat,
        locationLng: input.location?.lng,
        status: "draft",
      })
      .returning();

    return toItemDto(item, []);
  }

  async getById(itemId: string, userId?: string): Promise<ItemDto> {
    const item = await this.db.query.items.findFirst({
      where: and(eq(items.id, itemId), isNull(items.deletedAt)),
      with: {
        photos: {
          where: isNull(itemPhotos.deletedAt),
          orderBy: (p, { asc }) => [asc(p.orderIndex)],
        },
      },
    });

    if (!item) {
      throw new AppError("ITEM_NOT_FOUND", "Item not found", 404);
    }

    if (userId && item.ownerId !== userId && item.status === "draft") {
      throw new AppError("FORBIDDEN", "Not allowed", 403);
    }

    return toItemDto(item, item.photos);
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: {
      title?: string;
      description?: string;
      priceMin?: number;
      priceMax?: number;
      location?: GeoPoint;
      zoneId?: string;
    },
  ): Promise<ItemDto> {
    const existing = await this.assertOwner(userId, itemId);

    if (existing.status !== "draft" && existing.status !== "available") {
      throw new AppError(
        "INVALID_STATUS",
        "Item cannot be edited in current status",
        409,
      );
    }

    const [updated] = await this.db
      .update(items)
      .set({
        title: input.title,
        description: input.description,
        priceMin: input.priceMin,
        priceMax: input.priceMax,
        locationLat: input.location?.lat,
        locationLng: input.location?.lng,
        zoneId: input.zoneId,
      })
      .where(eq(items.id, itemId))
      .returning();

    const photos = await this.getPhotos(itemId);
    return toItemDto(updated, photos);
  }

  async publish(userId: string, itemId: string): Promise<ItemDto> {
    const existing = await this.assertOwner(userId, itemId);

    if (existing.status !== "draft") {
      throw new AppError("INVALID_STATUS", "Only draft items can be published", 409);
    }

    const photos = await this.getPhotos(itemId);
    const hasApproved = photos.some(
      (p) =>
        p.moderationStatus === "approved" ||
        (env.AUTO_APPROVE_PHOTOS && p.moderationStatus === "pending"),
    );

    if (!hasApproved) {
      throw new AppError(
        "NO_APPROVED_PHOTOS",
        "At least one approved photo is required",
        409,
      );
    }

    if (!existing.title?.trim()) {
      throw new AppError("MISSING_TITLE", "Title is required to publish", 409);
    }

    const [updated] = await this.db
      .update(items)
      .set({ status: "available" })
      .where(eq(items.id, itemId))
      .returning();

    return toItemDto(updated, photos);
  }

  async presignPhotoUpload(
    userId: string,
    itemId: string,
    input: { filename: string; contentType: string },
  ): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
    await this.assertOwner(userId, itemId);
    const key = buildObjectKey(userId, itemId, input.filename);
    const { uploadUrl, key: storageKey } = await createPresignedUploadUrl(
      key,
      input.contentType,
    );
    return { uploadUrl, storageKey, expiresIn: 900 };
  }

  async confirmPhotoUpload(
    userId: string,
    itemId: string,
    input: { storageKey: string; contentType: string; isPrimary?: boolean },
  ): Promise<ItemDto> {
    const existing = await this.assertOwner(userId, itemId);

    if (existing.status !== "draft") {
      throw new AppError(
        "INVALID_STATUS",
        "Photos can only be added to draft items",
        409,
      );
    }

    const originalBuffer = await getObjectBuffer(input.storageKey);
    const thumbnailBuffer = await sharp(originalBuffer)
      .resize(400, 400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbKey = input.storageKey.replace(/(\.[^.]+)?$/, "-thumb.jpg");
    await putObjectBuffer(thumbKey, thumbnailBuffer, "image/jpeg");

    const enrichment = await enrichItemFromImage(
      originalBuffer,
      input.contentType,
    );

    const moderationStatus = env.AUTO_APPROVE_PHOTOS ? "approved" : "pending";

    const photoCount = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(itemPhotos)
      .where(
        and(eq(itemPhotos.itemId, itemId), isNull(itemPhotos.deletedAt)),
      );

    const isPrimary = input.isPrimary ?? photoCount[0]?.count === 0;

    if (isPrimary) {
      await this.db
        .update(itemPhotos)
        .set({ isPrimary: false })
        .where(eq(itemPhotos.itemId, itemId));
    }

    await this.db.insert(itemPhotos).values({
      itemId,
      url: publicUrlForKey(input.storageKey),
      thumbnailUrl: publicUrlForKey(thumbKey),
      orderIndex: photoCount[0]?.count ?? 0,
      isPrimary,
      moderationStatus,
    });

    const [updated] = await this.db
      .update(items)
      .set({
        title: existing.title ?? (enrichment.title || null),
        description: existing.description ?? (enrichment.description || null),
        priceMin: existing.priceMin ?? enrichment.priceMin,
        priceMax: existing.priceMax ?? enrichment.priceMax,
        aiMetadata: enrichment.aiMetadata,
      })
      .where(eq(items.id, itemId))
      .returning();

    const photos = await this.getPhotos(itemId);
    return toItemDto(updated, photos);
  }

  async getFeed(
    userId: string,
    input: { limit?: number; cursor?: string },
  ): Promise<{ items: ItemDto[]; nextCursor: string | null }> {
    const limit = Math.min(input.limit ?? 20, 50);

    const swiped = await this.db
      .select({ itemId: swipes.itemId })
      .from(swipes)
      .where(eq(swipes.swiperUserId, userId));
    const swipedIds = swiped.map((s) => s.itemId);

    const conditions = [
      eq(items.status, "available"),
      isNull(items.deletedAt),
      ne(items.ownerId, userId),
    ];

    if (swipedIds.length > 0) {
      conditions.push(notInArray(items.id, swipedIds));
    }

    if (input.cursor) {
      conditions.push(lt(items.createdAt, new Date(input.cursor)));
    }

    const photoFilter = env.AUTO_APPROVE_PHOTOS
      ? or(
          eq(itemPhotos.moderationStatus, "approved"),
          eq(itemPhotos.moderationStatus, "pending"),
        )
      : eq(itemPhotos.moderationStatus, "approved");

    const rows = await this.db.query.items.findMany({
      where: and(...conditions),
      with: {
        photos: {
          where: and(isNull(itemPhotos.deletedAt), photoFilter),
        },
      },
      orderBy: [desc(items.createdAt)],
      limit: limit + 1,
    });

    const visible = rows.filter((r) => r.photos.length > 0);
    const page = visible.slice(0, limit);
    const nextCursor =
      visible.length > limit
        ? page[page.length - 1]?.createdAt.toISOString() ?? null
        : null;

    return {
      items: page.map((r) => toItemDto(r, r.photos)),
      nextCursor,
    };
  }

  private async assertOwner(
    userId: string,
    itemId: string,
  ): Promise<typeof items.$inferSelect> {
    const item = await this.db.query.items.findFirst({
      where: and(eq(items.id, itemId), isNull(items.deletedAt)),
    });
    if (!item) {
      throw new AppError("ITEM_NOT_FOUND", "Item not found", 404);
    }
    if (item.ownerId !== userId) {
      throw new AppError("FORBIDDEN", "Not the item owner", 403);
    }
    return item;
  }

  private async getPhotos(itemId: string) {
    return this.db
      .select()
      .from(itemPhotos)
      .where(and(eq(itemPhotos.itemId, itemId), isNull(itemPhotos.deletedAt)))
      .orderBy(itemPhotos.orderIndex);
  }
}
