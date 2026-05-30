import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { zones } from "./zones.js";

export const itemStatusEnum = pgEnum("item_status", [
  "draft",
  "available",
  "matched",
  "traded",
  "withdrawn",
]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "rejected",
]);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    title: text("title"),
    description: text("description"),
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    status: itemStatusEnum("status").notNull().default("draft"),
    locationLat: doublePrecision("location_lat"),
    locationLng: doublePrecision("location_lng"),
    zoneId: uuid("zone_id").references(() => zones.id),
    aiMetadata: jsonb("ai_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("items_owner_id_idx").on(table.ownerId),
    index("items_zone_id_status_idx").on(table.zoneId, table.status),
  ],
);

export const itemPhotos = pgTable(
  "item_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    orderIndex: integer("order_index").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("item_photos_item_id_idx").on(table.itemId)],
);

export const itemsRelations = relations(items, ({ one, many }) => ({
  owner: one(users, { fields: [items.ownerId], references: [users.id] }),
  zone: one(zones, { fields: [items.zoneId], references: [zones.id] }),
  photos: many(itemPhotos),
}));

export const itemPhotosRelations = relations(itemPhotos, ({ one }) => ({
  item: one(items, { fields: [itemPhotos.itemId], references: [items.id] }),
}));
