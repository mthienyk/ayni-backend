import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  authIdentities,
  magicLinkTokens,
  refreshTokens,
  users,
} from "../db/schema/index.js";
import { verifyAppleIdToken, verifyGoogleIdToken } from "../lib/auth/oauth.js";
import {
  generateInviteCode,
  generateSecureToken,
  hashToken,
  hashTokenLookup,
  normalizeEmail,
  verifyTokenHash,
} from "../lib/crypto.js";
import { emailService } from "../lib/email/index.js";
import { AppError } from "../lib/errors.js";
import { env } from "../lib/config.js";
import type { TokenPairResponse, UserPublic } from "../types/api.js";

type AuthProvider = "apple" | "google" | "email";

function toUserPublic(user: typeof users.$inferSelect): UserPublic {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    inviteCode: user.inviteCode,
    needsDisplayName: !user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * multipliers[unit];
}

export class AuthService {
  constructor(private readonly db: Database) {}

  async signInWithOAuth(input: {
    provider: "apple" | "google";
    idToken: string;
    inviteCode?: string;
  }): Promise<TokenPairResponse> {
    const profile =
      input.provider === "google"
        ? await verifyGoogleIdToken(input.idToken)
        : await verifyAppleIdToken(input.idToken);

    const existing = await this.db.query.authIdentities.findFirst({
      where: and(
        eq(authIdentities.provider, input.provider),
        eq(authIdentities.providerSubject, profile.subject),
      ),
      with: { user: true },
    });

    if (existing?.user && !existing.user.deletedAt) {
      return this.issueTokens(existing.user);
    }

    if (profile.email) {
      const linkedUser = await this.linkOAuthToExistingUser({
        provider: input.provider,
        subject: profile.subject,
        email: profile.email,
        displayName: profile.displayName,
      });
      if (linkedUser) {
        return this.issueTokens(linkedUser);
      }
    }

    const inviterId = input.inviteCode
      ? await this.resolveInviterId(input.inviteCode)
      : undefined;

    const [user] = await this.db
      .insert(users)
      .values({
        email: profile.email ? normalizeEmail(profile.email) : null,
        displayName: profile.displayName ?? null,
        inviteCode: generateInviteCode(),
        invitedByUserId: inviterId,
      })
      .returning();

    await this.db.insert(authIdentities).values({
      userId: user.id,
      provider: input.provider,
      providerSubject: profile.subject,
    });

    return this.issueTokens(user);
  }

  async requestMagicLink(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const token = generateSecureToken();
    const lookupHash = hashTokenLookup(token);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(
      Date.now() + env.MAGIC_LINK_TTL_MINUTES * 60_000,
    );

    await this.db
      .update(magicLinkTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(magicLinkTokens.email, normalized),
          isNull(magicLinkTokens.consumedAt),
        ),
      );

    await this.db.insert(magicLinkTokens).values({
      email: normalized,
      lookupHash,
      tokenHash,
      expiresAt,
    });

    await emailService.sendMagicLink(normalized, token);
  }

  async verifyMagicLink(input: {
    token: string;
    inviteCode?: string;
  }): Promise<TokenPairResponse> {
    const lookupHash = hashTokenLookup(input.token);
    const candidates = await this.db
      .select()
      .from(magicLinkTokens)
      .where(
        and(
          eq(magicLinkTokens.lookupHash, lookupHash),
          isNull(magicLinkTokens.consumedAt),
        ),
      )
      .limit(5);

    let matched: (typeof candidates)[number] | undefined;
    for (const row of candidates) {
      if (row.expiresAt < new Date()) continue;
      if (await verifyTokenHash(input.token, row.tokenHash)) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      throw new AppError("INVALID_TOKEN", "Invalid or expired magic link", 401);
    }

    const consumed = await this.db
      .update(magicLinkTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(magicLinkTokens.id, matched.id),
          isNull(magicLinkTokens.consumedAt),
        ),
      )
      .returning({ id: magicLinkTokens.id });

    if (consumed.length === 0) {
      throw new AppError("INVALID_TOKEN", "Invalid or expired magic link", 401);
    }

    const user = await this.resolveEmailAuthUser({
      email: matched.email,
      inviteCode: input.inviteCode,
    });

    return this.issueTokens(user);
  }

  buildMagicLinkCallbackUrl(token: string, inviteCode?: string): string {
    const url = new URL(env.MAGIC_LINK_CALLBACK_URL);
    url.searchParams.set("token", token);
    if (inviteCode) {
      url.searchParams.set("inviteCode", inviteCode);
    }
    return url.toString();
  }

  async refreshTokens(refreshToken: string): Promise<TokenPairResponse> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(isNull(refreshTokens.revokedAt))
      .limit(100);

    let matched: (typeof rows)[number] | undefined;
    for (const row of rows) {
      if (row.expiresAt < new Date()) continue;
      if (await verifyTokenHash(refreshToken, row.tokenHash)) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      throw new AppError("INVALID_REFRESH", "Invalid refresh token", 401);
    }

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, matched.id));

    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, matched.userId), isNull(users.deletedAt)),
    });

    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(isNull(refreshTokens.revokedAt))
      .limit(100);

    for (const row of rows) {
      if (await verifyTokenHash(refreshToken, row.tokenHash)) {
        await this.db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.id, row.id));
        return;
      }
    }
  }

  async getUserById(userId: string): Promise<UserPublic> {
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, userId), isNull(users.deletedAt)),
    });
    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }
    return toUserPublic(user);
  }

  async updateProfile(
    userId: string,
    input: { displayName?: string; avatarUrl?: string },
  ): Promise<UserPublic> {
    const [user] = await this.db
      .update(users)
      .set({
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        lastSeenAt: new Date(),
      })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();

    if (!user) {
      throw new AppError("USER_NOT_FOUND", "User not found", 404);
    }

    return toUserPublic(user);
  }

  getAccessTokenTtlMs(): number {
    return parseDurationToMs(env.JWT_ACCESS_TTL);
  }

  getRefreshTokenTtlMs(): number {
    return parseDurationToMs(env.JWT_REFRESH_TTL);
  }

  async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.getRefreshTokenTtlMs());
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });
  }

  private async linkOAuthToExistingUser(input: {
    provider: "apple" | "google";
    subject: string;
    email: string;
    displayName?: string;
  }): Promise<typeof users.$inferSelect | null> {
    const normalized = normalizeEmail(input.email);
    const existingUser = await this.db.query.users.findFirst({
      where: and(eq(users.email, normalized), isNull(users.deletedAt)),
    });

    if (!existingUser) {
      return null;
    }

    await this.db
      .insert(authIdentities)
      .values({
        userId: existingUser.id,
        provider: input.provider,
        providerSubject: input.subject,
      })
      .onConflictDoNothing({
        target: [authIdentities.provider, authIdentities.providerSubject],
      });

    if (!existingUser.displayName && input.displayName) {
      const [updated] = await this.db
        .update(users)
        .set({ displayName: input.displayName })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated ?? existingUser;
    }

    return existingUser;
  }

  private async resolveEmailAuthUser(input: {
    email: string;
    inviteCode?: string;
  }): Promise<typeof users.$inferSelect> {
    const existingIdentity = await this.db.query.authIdentities.findFirst({
      where: and(
        eq(authIdentities.provider, "email"),
        eq(authIdentities.providerSubject, input.email),
      ),
      with: { user: true },
    });

    if (existingIdentity?.user && !existingIdentity.user.deletedAt) {
      return existingIdentity.user;
    }

    const existingUser = await this.db.query.users.findFirst({
      where: and(eq(users.email, input.email), isNull(users.deletedAt)),
    });

    if (existingUser) {
      await this.db
        .insert(authIdentities)
        .values({
          userId: existingUser.id,
          provider: "email",
          providerSubject: input.email,
        })
        .onConflictDoNothing({
          target: [authIdentities.provider, authIdentities.providerSubject],
        });
      return existingUser;
    }

    const inviterId = input.inviteCode
      ? await this.resolveInviterId(input.inviteCode)
      : undefined;

    const [user] = await this.db
      .insert(users)
      .values({
        email: input.email,
        inviteCode: generateInviteCode(),
        invitedByUserId: inviterId,
      })
      .returning();

    await this.db.insert(authIdentities).values({
      userId: user.id,
      provider: "email",
      providerSubject: input.email,
    });

    return user;
  }

  private async issueTokens(
    user: typeof users.$inferSelect,
  ): Promise<TokenPairResponse> {
    if (user.status === "suspended") {
      throw new AppError("ACCOUNT_SUSPENDED", "Account suspended", 403);
    }

    const refreshToken = generateSecureToken();
    await this.persistRefreshToken(user.id, refreshToken);

    return {
      userId: user.id,
      accessToken: "",
      refreshToken,
      user: toUserPublic(user),
    };
  }

  private async resolveInviterId(inviteCode: string): Promise<string | undefined> {
    const inviter = await this.db.query.users.findFirst({
      where: and(eq(users.inviteCode, inviteCode), isNull(users.deletedAt)),
    });
    return inviter?.id;
  }
}

export type AuthProviderType = AuthProvider;
