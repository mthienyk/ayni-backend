import type { RenderedEmail } from "../types.js";
import { wrapHtmlEmail } from "./layout.js";

export function buildMagicLinkEmail(params: {
  verifyUrl: string;
  ttlMinutes: number;
}): RenderedEmail {
  const subject = "Connexion à Ayni";
  const text = [
    "Bonjour,",
    "",
    `Clique sur ce lien pour te connecter (valide ${params.ttlMinutes} min) :`,
    "",
    params.verifyUrl,
    "",
    "Si tu n'as pas demandé ce lien, ignore cet email.",
  ].join("\n");

  const html = wrapHtmlEmail({
    preview: "Ton lien de connexion Ayni",
    heading: "Connexion à Ayni",
    bodyHtml: `<p style="margin:0 0 16px;line-height:1.5;">
  Clique sur le bouton ci-dessous pour te connecter. Ce lien expire dans
  <strong>${params.ttlMinutes} minutes</strong>.
</p>`,
    ctaUrl: params.verifyUrl,
    ctaLabel: "Se connecter",
    footerNote:
      "Si tu n'as pas demandé ce lien, tu peux ignorer cet email en toute sécurité.",
  });

  return { subject, text, html };
}
