import type { RenderedEmail } from "../types.js";
import { wrapHtmlEmail } from "./layout.js";

export function buildSupportRequestEmail(params: {
  userEmail: string;
  subject: string;
  message: string;
}): RenderedEmail {
  const subject = `[Support Ayni] ${params.subject}`;
  const text = [
    "Nouvelle demande support",
    "",
    `De : ${params.userEmail}`,
    `Sujet : ${params.subject}`,
    "",
    params.message,
  ].join("\n");

  const html = wrapHtmlEmail({
    preview: `Support: ${params.subject}`,
    heading: "Nouvelle demande support",
    bodyHtml: `<p style="margin:0 0 8px;"><strong>De :</strong> ${escapeHtml(params.userEmail)}</p>
<p style="margin:0 0 16px;"><strong>Sujet :</strong> ${escapeHtml(params.subject)}</p>
<p style="margin:0;line-height:1.6;white-space:pre-line;">${escapeHtml(params.message)}</p>`,
  });

  return { subject, text, html };
}

export function buildSupportAckEmail(params: {
  subject: string;
}): RenderedEmail {
  const subject = "Nous avons bien reçu ta demande";
  const text = [
    "Bonjour,",
    "",
    `Nous avons bien reçu ta demande : "${params.subject}".`,
    "L'équipe Ayni te répondra dès que possible.",
  ].join("\n");

  const html = wrapHtmlEmail({
    preview: "Demande support reçue",
    heading: "Demande reçue",
    bodyHtml: `<p style="margin:0 0 16px;line-height:1.5;">
  Nous avons bien reçu ta demande : <strong>${escapeHtml(params.subject)}</strong>.
</p>
<p style="margin:0;line-height:1.5;">L'équipe Ayni te répondra dès que possible.</p>`,
  });

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
