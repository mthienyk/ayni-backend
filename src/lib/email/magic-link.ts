import { Resend } from "resend";
import { env } from "../config.js";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!env.RESEND_API_KEY) {
    throw new Error("Email service is not configured");
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendMagicLinkEmail(
  email: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${env.API_BASE_URL}/v1/auth/magic-link/verify?token=${token}`;

  if (env.NODE_ENV === "development" && !env.RESEND_API_KEY) {
    console.info(`[dev] Magic link for ${email}: ${verifyUrl}`);
    return;
  }

  const resend = getResend();
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Connexion à Ayni",
    text: `Clique sur ce lien pour te connecter (valide ${env.MAGIC_LINK_TTL_MINUTES} min) :\n\n${verifyUrl}`,
  });
}
