import type { RenderedEmail } from "../types.js";
import { wrapHtmlEmail } from "./layout.js";

export function buildNotificationEmail(params: {
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  preview?: string;
}): RenderedEmail {
  const subject = params.title;
  const textLines = ["Bonjour,", "", params.body];
  if (params.actionUrl) {
    textLines.push("", params.actionUrl);
  }
  const text = textLines.join("\n");

  const html = wrapHtmlEmail({
    preview: params.preview ?? params.title,
    heading: params.title,
    bodyHtml: `<p style="margin:0;line-height:1.6;white-space:pre-line;">${escapeHtml(params.body)}</p>`,
    ctaUrl: params.actionUrl,
    ctaLabel: params.actionLabel,
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
