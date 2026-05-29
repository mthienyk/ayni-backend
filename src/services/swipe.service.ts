import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  conversations,
  items,
  matches,
  swipes,
} from "../db/schema/index.js";
import { canonicalItemPair } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";

export type SwipeDto = {
  id: string;
  itemId: string;
  direction: "like" | "pass";
  createdAt: string;
  matchId: string | null;
};

export type MatchDto = {
  id: string;
  itemAId: string;
  itemBId: string;
  userAId: string;
  userBId: string;
  status: string;
  conversationId: string | null;
  createdAt: string;
};

export class MatchService {
  constructor(private readonly db: Database) {}

  async findReciprocalLike(
    swiperUserId: string,
    swipedItemOwnerId: string,
  ): Promise<string | null> {
    const reciprocal = await this.db
      .select({ swiperItemId: items.id })
      .from(swipes)
      .innerJoin(items, eq(swipes.itemId, items.id))
      .where(
        and(
          eq(swipes.swiperUserId, swipedItemOwnerId),
          eq(swipes.direction, "like"),
          eq(items.ownerId, swiperUserId),
          eq(items.status, "available"),
          isNull(items.deletedAt),
        ),
      )
      .limit(1);

    return reciprocal[0]?.swiperItemId ?? null;
  }

  async createMatchIfReciprocal(
    swiperUserId: string,
    swipedItemId: string,
    swiperItemId: string,
  ): Promise<MatchDto | null> {
    const { itemLowId, itemHighId } = canonicalItemPair(
      swiperItemId,
      swipedItemId,
    );

    const swipedItem = await this.db.query.items.findFirst({
      where: eq(items.id, swipedItemId),
    });
    const swiperItem = await this.db.query.items.findFirst({
      where: eq(items.id, swiperItemId),
    });

    if (!swipedItem || !swiperItem) return null;

    const inserted = await this.db
      .insert(matches)
      .values({
        itemAId: swiperItemId,
        itemBId: swipedItemId,
        itemLowId,
        itemHighId,
        userAId: swiperUserId,
        userBId: swipedItem.ownerId,
        status: "active",
      })
      .onConflictDoNothing({
        target: [matches.itemLowId, matches.itemHighId],
      })
      .returning();

    const match = inserted[0];

    if (!match) {
      const existing = await this.db.query.matches.findFirst({
        where: and(
          eq(matches.itemLowId, itemLowId),
          eq(matches.itemHighId, itemHighId),
          isNull(matches.deletedAt),
        ),
        with: { conversation: true },
      });
      if (!existing) return null;
      return this.toMatchDto(existing, existing.conversation?.id ?? null);
    }

    await this.db
      .update(items)
      .set({ status: "matched" })
      .where(inArray(items.id, [swiperItemId, swipedItemId]));

    const [conversation] = await this.db
      .insert(conversations)
      .values({ matchId: match.id })
      .returning();

    return this.toMatchDto(match, conversation.id);
  }

  async listForUser(userId: string): Promise<MatchDto[]> {
    const rows = await this.db.query.matches.findMany({
      where: and(
        isNull(matches.deletedAt),
        or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
        or(eq(matches.status, "active"), eq(matches.status, "in_progress")),
      ),
      with: { conversation: true },
      orderBy: [desc(matches.createdAt)],
    });

    return rows.map((m) => this.toMatchDto(m, m.conversation?.id ?? null));
  }

  private toMatchDto(
    match: typeof matches.$inferSelect,
    conversationId: string | null,
  ): MatchDto {
    return {
      id: match.id,
      itemAId: match.itemAId,
      itemBId: match.itemBId,
      userAId: match.userAId,
      userBId: match.userBId,
      status: match.status,
      conversationId,
      createdAt: match.createdAt.toISOString(),
    };
  }
}

export class SwipeService {
  constructor(
    private readonly db: Database,
    private readonly matchService: MatchService,
  ) {}

  async swipe(
    userId: string,
    input: { itemId: string; direction: "like" | "pass" },
  ): Promise<{ swipe: SwipeDto; match: MatchDto | null }> {
    const item = await this.db.query.items.findFirst({
      where: and(
        eq(items.id, input.itemId),
        eq(items.status, "available"),
        isNull(items.deletedAt),
      ),
    });

    if (!item) {
      throw new AppError("ITEM_NOT_FOUND", "Item not available", 404);
    }

    if (item.ownerId === userId) {
      throw new AppError("CANNOT_SWIPE_OWN", "Cannot swipe your own item", 409);
    }

    const existing = await this.db.query.swipes.findFirst({
      where: and(
        eq(swipes.swiperUserId, userId),
        eq(swipes.itemId, input.itemId),
      ),
    });

    if (existing) {
      throw new AppError("ALREADY_SWIPED", "Already swiped this item", 409);
    }

    const [swipeRow] = await this.db
      .insert(swipes)
      .values({
        swiperUserId: userId,
        itemId: input.itemId,
        direction: input.direction,
      })
      .returning();

    let match: MatchDto | null = null;

    if (input.direction === "like") {
      const reciprocal = await this.matchService.findReciprocalLike(
        userId,
        item.ownerId,
      );
      if (reciprocal) {
        match = await this.matchService.createMatchIfReciprocal(
          userId,
          input.itemId,
          reciprocal,
        );
      }
    }

    return {
      swipe: {
        id: swipeRow.id,
        itemId: swipeRow.itemId,
        direction: swipeRow.direction,
        createdAt: swipeRow.createdAt.toISOString(),
        matchId: match?.id ?? null,
      },
      match,
    };
  }

  async listHistory(
    userId: string,
    input: { limit?: number; cursor?: string },
  ): Promise<{ swipes: SwipeDto[]; nextCursor: string | null }> {
    const limit = Math.min(input.limit ?? 20, 50);
    const conditions = [eq(swipes.swiperUserId, userId)];

    if (input.cursor) {
      conditions.push(lt(swipes.createdAt, new Date(input.cursor)));
    }

    const rows = await this.db.query.swipes.findMany({
      where: and(...conditions),
      orderBy: [desc(swipes.createdAt)],
      limit: limit + 1,
    });

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit
        ? page[page.length - 1]?.createdAt.toISOString() ?? null
        : null;

    return {
      swipes: page.map((s) => ({
        id: s.id,
        itemId: s.itemId,
        direction: s.direction,
        createdAt: s.createdAt.toISOString(),
        matchId: null,
      })),
      nextCursor,
    };
  }
}
