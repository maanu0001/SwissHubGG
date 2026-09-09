import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

/**
 * Rich-Text-Verarbeitung.
 *
 * Redaktionen schreiben Markdown; daraus wird serverseitig HTML erzeugt und
 * anschliessend gegen eine enge Positivliste gefiltert. Freies HTML oder
 * JavaScript aus dem CMS erreicht die Website dadurch nie.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'code', 'pre',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'hr', 'table', 'thead',
  'tbody', 'tr', 'th', 'td',
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    th: ['scope'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // Externe Links erhalten immer sichere Attribute.
    a: (tagName, attribs) => {
      const href = attribs.href ?? '';
      const isExternal = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: {
          ...attribs,
          ...(isExternal ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}),
        },
      };
    },
  },
};

marked.setOptions({ gfm: true, breaks: true });

/** Wandelt Markdown in sicheres HTML für die Ausgabe um. */
export function renderRichText(markdown: string): string {
  if (!markdown.trim()) return '';
  const html = marked.parse(markdown, { async: false });
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Filtert bereits vorhandenes HTML (z. B. aus Importen). */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/** Entfernt jegliches Markup – für Meta-Beschreibungen und Vorschautexte. */
export function toPlainText(input: string, maxLength = 300): string {
  const stripped = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Prüft, ob eine vom Dashboard gepflegte URL sicher ausgeliefert werden kann.
 * Erlaubt sind absolute http(s)-Adressen, mailto und interne Pfade.
 */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  if (value.length === 0) return null;

  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#')) return value;

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
