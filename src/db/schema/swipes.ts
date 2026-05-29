import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { items } from "./items.js";

export const swipeDirectionEnum = pgEnum("swipe_direction", ["like", "pass"]);

export const swipes = pgTable(
  "swipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    swiperUserId: uuid("swiper_user_id")
      .notNull()
      .references(() => users.id),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id),
    direction: swipeDirectionEnum("direction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("swipes_swiper_item_unique").on(
      table.swiperUserId,
      table.itemId,
    ),
    index("swipes_swiper_created_idx").on(
      table.swiperUserId,
      table.createdAt,
    ),
    index("swipes_item_id_idx").on(table.itemId),
  ],
);

export const matchStatusEnum = pgEnum("match_status", [
  "active",
  "in_progress",
  "completed",
  "cancelled",
]);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemAId: uuid("item_a_id")
      .notNull()
      .references(() => items.id),
    itemBId: uuid("item_b_id")
      .notNull()
      .references(() => items.id),
    itemLowId: uuid("item_low_id")
      .notNull()
      .references(() => items.id),
    itemHighId: uuid("item_high_id")
      .notNull()
      .references(() => items.id),
    userAId: uuid("user_a_id")
      .notNull()
      .references(() => users.id),
    userBId: uuid("user_b_id")
      .notNull()
      .references(() => users.id),
    status: matchStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("matches_item_pair_unique").on(
      table.itemLowId,
      table.itemHighId,
    ),
    index("matches_user_a_idx").on(table.userAId),
    index("matches_user_b_idx").on(table.userBId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id)
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("conversations_match_id_idx").on(table.matchId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const swipesRelations = relations(swipes, ({ one }) => ({
  swiper: one(users, {
    fields: [swipes.swiperUserId],
    references: [users.id],
  }),
  item: one(items, { fields: [swipes.itemId], references: [items.id] }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  itemA: one(items, { fields: [matches.itemAId], references: [items.id] }),
  itemB: one(items, { fields: [matches.itemBId], references: [items.id] }),
  userA: one(users, { fields: [matches.userAId], references: [users.id] }),
  userB: one(users, { fields: [matches.userBId], references: [users.id] }),
  conversation: one(conversations, {
    fields: [matches.id],
    references: [conversations.matchId],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    match: one(matches, {
      fields: [conversations.matchId],
      references: [matches.id],
    }),
    messages: many(messages),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));
