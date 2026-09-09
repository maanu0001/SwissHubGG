/**
 * Ersatz für das Paket `server-only` in Tests.
 *
 * `server-only` wirft beim Import ausserhalb einer Server-Umgebung. In den
 * Tests werden die Module direkt unter Node ausgeführt; die Markierung ist
 * dort weder nötig noch möglich.
 */
export {};
