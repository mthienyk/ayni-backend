import { and, eq, isNull } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import { AppError } from "../lib/errors.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  const userId = request.user.sub;
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
    columns: { id: true, status: true },
  });

  if (!user) {
    return reply.status(401).send({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  if (user.status === "suspended") {
    return reply.status(403).send({
      error: {
        code: "ACCOUNT_SUSPENDED",
        message: "Account suspended",
      },
    });
  }
}

export function getUserId(request: FastifyRequest): string {
  const sub = request.user?.sub;
  if (!sub) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  return sub;
}
