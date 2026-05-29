import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { geometryPolygon } from "./geo.js";

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    polygon: geometryPolygon("polygon").notNull(),
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
