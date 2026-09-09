import { describe, expect, it } from 'vitest';
import { renderRichText, safeUrl, sanitizeRichHtml, toPlainText } from '@/lib/sanitize';

/**
 * Rich-Text-Sanitisierung: Diese Prüfungen sichern die zentrale Schutzschicht
 * gegen XSS über CMS-Inhalte ab.
 */
describe('renderRichText', () => {
  it('wandelt Markdown in HTML um', () => {
    const html = renderRichText('## Titel\n\nEin **fetter** Text.');
    expect(html).toContain('<h2>Titel</h2>');
    expect(html).toContain('<strong>fetter</strong>');
  });

  it('entfernt Skript-Tags', () => {
    const html = renderRichText('Hallo <script>alert(1)</script> Welt');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('entfernt Event-Handler-Attribute', () => {
    const html = sanitizeRichHtml('<p onclick="alert(1)">Text</p>');
    expect(html).not.toContain('onclick');
    expect(html).toContain('Text');
  });

  it('entfernt javascript:-Links', () => {
    const html = sanitizeRichHtml('<a href="javascript:alert(1)">Klick</a>');
    expect(html).not.toContain('javascript:');
  });

  it('entfernt iframes und Objekte', () => {
    const html = sanitizeRichHtml('<iframe src="https://example.com"></iframe><object data="x"></object>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<object');
  });

  it('versieht externe Links mit sicheren Attributen', () => {
    const html = renderRichText('[Beispiel](https://example.com)');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it('lässt interne Links ohne target', () => {
    const html = renderRichText('[Turniere](/turniere)');
    expect(html).toContain('href="/turniere"');
    expect(html).not.toContain('target="_blank"');
  });

  it('gibt bei leerer Eingabe eine leere Zeichenkette zurück', () => {
    expect(renderRichText('   ')).toBe('');
  });
});

describe('toPlainText', () => {
  it('entfernt jegliches Markup', () => {
    expect(toPlainText('<p>Hallo <strong>Welt</strong></p>')).toBe('Hallo Welt');
  });

  it('kürzt auf die gewünschte Länge', () => {
    const result = toPlainText('a'.repeat(100), 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('safeUrl', () => {
  it('erlaubt interne Pfade', () => {
    expect(safeUrl('/turniere')).toBe('/turniere');
  });

  it('erlaubt http, https und mailto', () => {
    expect(safeUrl('https://swisshub.gg')).toBe('https://swisshub.gg/');
    expect(safeUrl('mailto:info@swisshub.gg')).toBe('mailto:info@swisshub.gg');
  });

  it('lehnt javascript: und data: ab', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('lehnt protokollrelative Adressen ab', () => {
    expect(safeUrl('//evil.example.com')).toBeNull();
  });

  it('behandelt leere Werte als nicht gesetzt', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
});
