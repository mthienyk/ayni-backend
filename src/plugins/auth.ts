import type { FastifyReply, FastifyRequest } from "fastify";
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
}

export function getUserId(request: FastifyRequest): string {
  const sub = request.user?.sub;
  if (!sub) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  return sub;
}
