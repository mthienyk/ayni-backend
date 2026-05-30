const BRAND = "Ayni";

export function wrapHtmlEmail(params: {
  preview: string;
  heading: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  footerNote?: string;
}): string {
  const ctaBlock =
    params.ctaUrl && params.ctaLabel
      ? `<p style="margin:24px 0;">
  <a href="${params.ctaUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
    ${params.ctaLabel}
  </a>
</p>
<p style="color:#666;font-size:13px;word-break:break-all;">${params.ctaUrl}</p>`
      : "";

  const footer = params.footerNote
    ? `<p style="color:#888;font-size:12px;margin-top:32px;">${params.footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;">
  <span style="display:none;max-height:0;overflow:hidden;">${params.preview}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#666;">${BRAND}</p>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${params.heading}</h1>
              ${params.bodyHtml}
              ${ctaBlock}
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
