import { Resend } from "resend";
import { env } from "../config.js";
import { AppError } from "../errors.js";
import type { EmailPayload, EmailSendResult } from "./types.js";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new AppError(
      "EMAIL_NOT_CONFIGURED",
      "Email service is not configured",
      503,
    );
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

function shouldUseDevFallback(): boolean {
  return env.NODE_ENV === "development" && !env.RESEND_API_KEY;
}

function logDevEmail(payload: EmailPayload): void {
  console.info(
    `[dev:email] category=${payload.category} to=${formatRecipients(payload.to)} subject="${payload.subject}"`,
  );
  console.info(payload.text);
  if (payload.replyTo) {
    console.info(`[dev:email] replyTo=${payload.replyTo}`);
  }
}

function formatRecipients(to: string | string[]): string {
  return Array.isArray(to) ? to.join(", ") : to;
}

export async function sendEmail(
  payload: EmailPayload,
): Promise<EmailSendResult> {
  if (shouldUseDevFallback()) {
    logDevEmail(payload);
    return { id: null, devMode: true };
  }

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    replyTo: payload.replyTo,
    tags: payload.tags?.map((tag) => ({
      name: tag.name,
      value: tag.value,
    })),
  });

  if (error) {
    throw new AppError(
      "EMAIL_SEND_FAILED",
      error.message ?? "Failed to send email",
      502,
      error,
    );
  }

  return { id: data?.id ?? null, devMode: false };
}

export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY || shouldUseDevFallback();
}
