import 'server-only';

/**
 * Schlanker, prozessinterner Cache mit Tag-basierter Invalidierung.
 *
 * Die öffentliche Website liest ihre Inhalte über diesen Cache, damit ein
 * Seitenaufruf im Normalfall keine Datenbankabfrage auslöst. Beim
 * Veröffentlichen im Admin-Dashboard werden gezielt die betroffenen Tags
 * geleert – es gibt kein Polling und keine pauschale Invalidierung.
 *
 * Der Cache ist bewusst prozessintern gehalten: Der dokumentierte Betrieb ist
 * ein einzelner Anwendungscontainer hinter Nginx. Bei mehreren Instanzen
 * greift zusätzlich die TTL, sodass Inhalte spätestens danach konsistent sind.
 */

type Entry = {
  value: unknown;
  expiresAt: number;
  tags: string[];
};

type CacheStore = {
  entries: Map<string, Entry>;
  inflight: Map<string, Promise<unknown>>;
};

const globalForCache = globalThis as unknown as { __swisshubCache?: CacheStore };

const store: CacheStore = (globalForCache.__swisshubCache ??= {
  entries: new Map(),
  inflight: new Map(),
});

/** Standard-Lebensdauer für öffentliche Inhalte in Sekunden. */
export const DEFAULT_TTL_SECONDS = 300;

export const CacheTag = {
  settings: 'settings',
  navigation: 'navigation',
  pages: 'pages',
  page: (slug: string) => `page:${slug}`,
  tournaments: 'tournaments',
  tournament: (slug: string) => `tournament:${slug}`,
  sponsors: 'sponsors',
  social: 'social',
  team: 'team',
  featureFlags: 'feature-flags',
  redirects: 'redirects',
} as const;

export async function cached<T>(
  key: string,
  tags: string[],
  loader: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const now = Date.now();
  const hit = store.entries.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  // Mehrere gleichzeitige Anfragen teilen sich denselben Ladevorgang.
  const running = store.inflight.get(key);
  if (running) {
    return running as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      store.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000, tags });
      return value;
    })
    .finally(() => {
      store.inflight.delete(key);
    });

  store.inflight.set(key, promise);
  return promise;
}

/** Entfernt alle Einträge, die mindestens einen der angegebenen Tags tragen. */
export function invalidateTags(...tags: string[]): void {
  if (tags.length === 0) return;
  const wanted = new Set(tags);

  for (const [key, entry] of store.entries) {
    if (entry.tags.some((tag) => wanted.has(tag))) {
      store.entries.delete(key);
    }
  }
}

export function invalidateAll(): void {
  store.entries.clear();
}

export function cacheStats(): { entries: number; inflight: number } {
  return { entries: store.entries.size, inflight: store.inflight.size };
}
