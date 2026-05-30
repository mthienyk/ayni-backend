import { env } from "../config.js";
import { AppError } from "../errors.js";
import { sendEmail } from "./client.js";
import { buildMagicLinkEmail } from "./templates/auth.js";
import { buildNotificationEmail } from "./templates/notification.js";
import {
  buildSupportAckEmail,
  buildSupportRequestEmail,
} from "./templates/support.js";

export class EmailService {
  async sendMagicLink(email: string, token: string): Promise<void> {
    const verifyUrl = `${env.MAGIC_LINK_CALLBACK_URL}?token=${encodeURIComponent(token)}`;
    const rendered = buildMagicLinkEmail({
      verifyUrl,
      ttlMinutes: env.MAGIC_LINK_TTL_MINUTES,
    });

    await sendEmail({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      category: "auth",
      tags: [
        { name: "category", value: "auth" },
        { name: "template", value: "magic_link" },
      ],
    });
  }

  async sendNotification(params: {
    to: string;
    title: string;
    body: string;
    actionUrl?: string;
    actionLabel?: string;
    preview?: string;
    replyTo?: string;
  }): Promise<void> {
    const rendered = buildNotificationEmail(params);

    await sendEmail({
      to: params.to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      replyTo: params.replyTo ?? env.EMAIL_REPLY_TO,
      category: "transactional",
      tags: [
        { name: "category", value: "transactional" },
        { name: "template", value: "notification" },
      ],
    });
  }

  async sendSupportRequest(params: {
    userEmail: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const supportInbox = env.EMAIL_SUPPORT_TO ?? env.EMAIL_REPLY_TO;
    if (!supportInbox) {
      throw new AppError(
        "EMAIL_SUPPORT_NOT_CONFIGURED",
        "Support inbox is not configured",
        503,
      );
    }

    const teamEmail = buildSupportRequestEmail(params);
    await sendEmail({
      to: supportInbox,
      subject: teamEmail.subject,
      text: teamEmail.text,
      html: teamEmail.html,
      replyTo: params.userEmail,
      category: "support",
      tags: [
        { name: "category", value: "support" },
        { name: "template", value: "support_request" },
      ],
    });

    const ack = buildSupportAckEmail({ subject: params.subject });
    await sendEmail({
      to: params.userEmail,
      subject: ack.subject,
      text: ack.text,
      html: ack.html,
      replyTo: env.EMAIL_REPLY_TO,
      category: "support",
      tags: [
        { name: "category", value: "support" },
        { name: "template", value: "support_ack" },
      ],
    });
  }
}

export const emailService = new EmailService();
