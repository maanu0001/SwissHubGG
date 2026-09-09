import { headers } from 'next/headers';

/**
 * Gibt strukturierte Daten als JSON-LD aus.
 * Die Nonce der Content-Security-Policy wird mitgegeben, damit kein
 * `unsafe-inline` für Skripte nötig ist.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;

  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Der Inhalt stammt ausschliesslich aus serverseitig erzeugten Objekten.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
