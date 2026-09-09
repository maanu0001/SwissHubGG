import 'server-only';
import { renderRichText, toPlainText } from '@/lib/sanitize';

/**
 * E-Mail-Vorlagen im SwissHub-Layout.
 *
 * Die Gestaltung bleibt bewusst schlicht und tabellenbasiert, damit sie in
 * allen gängigen Mailprogrammen zuverlässig dargestellt wird. Alle
 * eingesetzten Werte werden escaped.
 */

const BRAND = {
  accent: '#83060A',
  background: '#0B0C10',
  surface: '#15161C',
  text: '#F2F3F5',
  muted: '#A8ABB4',
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type MailLayoutInput = {
  title: string;
  intro?: string;
  bodyHtml: string;
  footerNote?: string;
  appUrl: string;
};

export function renderLayout(input: MailLayoutInput): string {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.background};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${BRAND.surface};border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding:20px 24px;border-bottom:2px solid ${BRAND.accent};">
                <span style="color:${BRAND.text};font-size:18px;font-weight:700;letter-spacing:0.02em;">SwissHub</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:${BRAND.text};font-size:15px;line-height:1.6;">
                <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND.text};">${escapeHtml(input.title)}</h1>
                ${input.intro ? `<p style="margin:0 0 16px;color:${BRAND.muted};">${escapeHtml(input.intro)}</p>` : ''}
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:${BRAND.background};color:${BRAND.muted};font-size:12px;line-height:1.5;">
                ${input.footerNote ? `<p style="margin:0 0 8px;">${escapeHtml(input.footerNote)}</p>` : ''}
                <p style="margin:0;">SwissHub · <a href="${escapeHtml(input.appUrl)}" style="color:${BRAND.muted};">${escapeHtml(input.appUrl.replace(/^https?:\/\//, ''))}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Definitionsliste für strukturierte Angaben in Benachrichtigungen. */
export function renderDefinitionList(entries: { label: string; value: string }[]): string {
  const rows = entries
    .filter((entry) => entry.value.trim().length > 0)
    .map(
      (entry) => `<tr>
        <td style="padding:6px 12px 6px 0;color:${BRAND.muted};font-size:13px;vertical-align:top;white-space:nowrap;">${escapeHtml(entry.label)}</td>
        <td style="padding:6px 0;color:${BRAND.text};font-size:14px;">${escapeHtml(entry.value)}</td>
      </tr>`,
    )
    .join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;">${rows}</table>`;
}

export function renderQuotedText(text: string): string {
  const safe = escapeHtml(text).replace(/\n/g, '<br />');
  return `<div style="padding:14px 16px;background:${BRAND.background};border-left:3px solid ${BRAND.accent};border-radius:6px;color:${BRAND.text};font-size:14px;line-height:1.6;">${safe}</div>`;
}

export function renderButton(label: string, href: string): string {
  return `<p style="margin:20px 0 0;"><a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 20px;background:${BRAND.accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

/** Wandelt eine im Dashboard gepflegte Markdown-Vorlage in HTML und Text um. */
export function renderTemplateBody(markdown: string, variables: Record<string, string>): { html: string; text: string } {
  const replaced = Object.entries(variables).reduce(
    (accumulator, [key, value]) => accumulator.replaceAll(`{{${key}}}`, value),
    markdown,
  );

  return { html: renderRichText(replaced), text: toPlainText(replaced, 5000) };
}

export function htmlToPlainText(html: string): string {
  return toPlainText(html, 10_000);
}
