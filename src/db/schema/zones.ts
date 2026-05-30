import { index, integer, pgTable, text, timestamp, uuid, doublePrecision } from "drizzle-orm/pg-core";

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    centerLat: doublePrecision("center_lat").notNull(),
    centerLng: doublePrecision("center_lng").notNull(),
    radiusMeters: integer("radius_meters").notNull().default(1000),
    h3Index: text("h3_index"),
    currentUserCount: integer("current_user_count").notNull().default(0),
    thresholdUnlockedAt: timestamp("threshold_unlocked_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("zones_h3_index_idx").on(table.h3Index)],
);
