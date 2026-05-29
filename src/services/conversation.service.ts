import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  conversations,
  matches,
  messages,
} from "../db/schema/index.js";
import { AppError } from "../lib/errors.js";

export type MessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export class ConversationService {
  constructor(private readonly db: Database) {}

  async assertParticipant(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        isNull(conversations.deletedAt),
      ),
      with: { match: true },
    });

    if (!conversation?.match) {
      throw new AppError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);
    }

    const { userAId, userBId } = conversation.match;
    if (userId !== userAId && userId !== userBId) {
      throw new AppError("FORBIDDEN", "Not a participant", 403);
    }
  }

  async listMessages(
    userId: string,
    conversationId: string,
    input: { since?: string; limit?: number },
  ): Promise<{ messages: MessageDto[] }> {
    await this.assertParticipant(userId, conversationId);

    const limit = Math.min(input.limit ?? 50, 100);
    const conditions = [eq(messages.conversationId, conversationId)];

    if (input.since) {
      conditions.push(gt(messages.createdAt, new Date(input.since)));
    }

    const rows = await this.db.query.messages.findMany({
      where: and(...conditions),
      orderBy: [desc(messages.createdAt)],
      limit,
    });

    return {
      messages: rows
        .reverse()
        .map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          readAt: m.readAt?.toISOString() ?? null,
        })),
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    body: string,
  ): Promise<MessageDto> {
    await this.assertParticipant(userId, conversationId);

    const [message] = await this.db
      .insert(messages)
      .values({ conversationId, senderId: userId, body })
      .returning();

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      readAt: null,
    };
  }

  async getByMatchId(userId: string, matchId: string): Promise<string> {
    const match = await this.db.query.matches.findFirst({
      where: and(eq(matches.id, matchId), isNull(matches.deletedAt)),
      with: { conversation: true },
    });

    if (!match) {
      throw new AppError("MATCH_NOT_FOUND", "Match not found", 404);
    }

    if (userId !== match.userAId && userId !== match.userBId) {
      throw new AppError("FORBIDDEN", "Not a participant", 403);
    }

    if (match.conversation) {
      return match.conversation.id;
    }

    const [conversation] = await this.db
      .insert(conversations)
      .values({ matchId: match.id })
      .returning();

    return conversation.id;
  }
}
