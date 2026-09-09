import Image from 'next/image';
import { PageHeader, Panel, Field, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { deleteMediaAction, replaceMediaAction, updateMediaAction, uploadMediaAction } from '@/server/actions/media';
import { mediaUsage } from '@/lib/mediaUsage';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatBytes, formatDateTime } from '@/lib/format';

export const metadata = { title: 'Medien' };

const PAGE_SIZE = 24;

type PageProps = { searchParams: Promise<{ suche?: string; seite?: string }> };

/** Medienbibliothek mit Upload, Metadatenpflege, Ersetzen und Löschen. */
export default async function AdminMediaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await requirePermission(PERMISSIONS.MEDIA_VIEW);
  const canManage = userHasPermission(user, PERMISSIONS.MEDIA_MANAGE);

  const search = (params.suche ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.seite ?? '1', 10) || 1);

  const where = search
    ? {
        OR: [
          { originalName: { contains: search, mode: 'insensitive' as const } },
          { title: { contains: search, mode: 'insensitive' as const } },
          { alt: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [assets, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { uploadedBy: { select: { displayName: true } } },
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  const usageByAsset = await Promise.all(assets.map((asset) => mediaUsage(asset.id)));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Medienbibliothek"
        description="Bilder und Dokumente für Seiten, Turniere, Sponsoren und Social-Beiträge."
      />

      <div className="space-y-6">
        {canManage ? (
          <Panel title="Dateien hochladen">
            <ActionForm action={uploadMediaAction} resetOnSuccess className="space-y-4">
              <Field
                label="Dateien"
                name="files"
                hint={`Erlaubt: JPEG, PNG, WebP, AVIF, GIF und PDF bis ${env().MAX_UPLOAD_MB} MB. Bilder werden beim Upload neu kodiert und optimiert; Metadaten werden dabei entfernt.`}
              >
                <input
                  id="files"
                  name="files"
                  type="file"
                  multiple
                  required
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf"
                  className="input file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-surface-raised)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--color-ink)]"
                />
              </Field>
              <SubmitButton pendingLabel="Wird hochgeladen …">Hochladen</SubmitButton>
            </ActionForm>
          </Panel>
        ) : null}

        <Panel title={`${total} Datei(en)`}>
          <form method="get" className="mb-6 flex gap-3">
            <div className="flex-1">
              <label htmlFor="suche" className="sr-only">
                Medien durchsuchen
              </label>
              <input
                id="suche"
                name="suche"
                type="search"
                defaultValue={search}
                placeholder="Nach Dateiname, Titel oder Alt-Text suchen"
                className="input"
              />
            </div>
            <button type="submit" className="btn-secondary">
              Suchen
            </button>
          </form>

          {assets.length === 0 ? (
            <InfoBox tone="info" title="Keine Dateien">
              {search
                ? 'Für diese Suche wurden keine Dateien gefunden.'
                : 'Die Medienbibliothek ist noch leer. Lade oben die ersten Dateien hoch.'}
            </InfoBox>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset, index) => {
                const usage = usageByAsset[index] ?? [];

                return (
                  <li key={asset.id} className="rounded-lg border border-[var(--color-line)] p-4">
                    <div className="relative mb-3 aspect-video overflow-hidden rounded border border-[var(--color-line)] bg-[var(--color-canvas)]">
                      {asset.kind === 'IMAGE' ? (
                        <Image
                          src={`/api/media/${asset.storageKey}`}
                          alt={asset.alt ?? ''}
                          fill
                          sizes="(min-width: 1024px) 300px, 45vw"
                          className="object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-sm text-[var(--color-ink-subtle)]">
                          {asset.mimeType}
                        </span>
                      )}
                    </div>

                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                      {asset.title ?? asset.originalName}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                      {formatBytes(asset.byteSize)}
                      {asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ''} ·{' '}
                      {formatDateTime(asset.createdAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                      Hochgeladen von {asset.uploadedBy?.displayName ?? 'unbekannt'}
                    </p>

                    {!asset.alt && asset.kind === 'IMAGE' ? (
                      <p className="mt-2 text-xs text-[var(--color-warning-text)]">
                        Ohne Alt-Text – bitte für die Barrierefreiheit ergänzen.
                      </p>
                    ) : null}

                    {usage.length > 0 ? (
                      <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
                        Verwendet in: {usage.map((entry) => `${entry.label} (${entry.count})`).join(', ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--color-ink-subtle)]">Aktuell nicht verwendet.</p>
                    )}

                    {canManage ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-[var(--color-brand-text)]">
                          Bearbeiten
                        </summary>

                        <ActionForm action={updateMediaAction} className="mt-3 space-y-3">
                          <input type="hidden" name="id" value={asset.id} />
                          <Field label="Alt-Text" name={`alt-${asset.id}`} errorKey="alt" hint="Beschreibt den Bildinhalt für Screenreader.">
                            <input id={`alt-${asset.id}`} name="alt" type="text" maxLength={200} defaultValue={asset.alt ?? ''} className="input" />
                          </Field>
                          <Field label="Titel" name={`title-${asset.id}`} errorKey="title">
                            <input id={`title-${asset.id}`} name="title" type="text" maxLength={150} defaultValue={asset.title ?? ''} className="input" />
                          </Field>
                          <SubmitButton variant="secondary">Speichern</SubmitButton>
                        </ActionForm>

                        <ActionForm action={replaceMediaAction} className="mt-4 space-y-3 border-t border-[var(--color-line)] pt-4">
                          <input type="hidden" name="id" value={asset.id} />
                          <Field
                            label="Datei ersetzen"
                            name={`file-${asset.id}`} errorKey="file"
                            hint="Alle Verwendungen zeigen anschliessend die neue Datei."
                          >
                            <input id={`file-${asset.id}`} name="file" type="file" required className="input" />
                          </Field>
                          <SubmitButton variant="secondary" pendingLabel="Wird ersetzt …">
                            Ersetzen
                          </SubmitButton>
                        </ActionForm>

                        <ActionForm action={deleteMediaAction} className="mt-4 space-y-3 border-t border-[var(--color-line)] pt-4">
                          <input type="hidden" name="id" value={asset.id} />
                          {usage.length > 0 ? (
                            <label className="flex items-start gap-2 text-xs text-[var(--color-warning-text)]">
                              <input type="checkbox" name="confirmUsed" value="ja" className="mt-0.5 h-3.5 w-3.5 accent-[var(--color-brand)]" />
                              Ich weiss, dass dieses Medium noch verwendet wird.
                            </label>
                          ) : null}
                          <SubmitButton variant="danger" confirm="Datei endgültig löschen?">
                            Löschen
                          </SubmitButton>
                        </ActionForm>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 ? (
            <nav aria-label="Seiten" className="mt-6 flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-subtle)]">
                Seite {page} von {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <a href={`/admin/medien?seite=${page - 1}${search ? `&suche=${encodeURIComponent(search)}` : ''}`} className="btn-secondary btn-sm">
                    Zurück
                  </a>
                ) : null}
                {page < totalPages ? (
                  <a href={`/admin/medien?seite=${page + 1}${search ? `&suche=${encodeURIComponent(search)}` : ''}`} className="btn-secondary btn-sm">
                    Weiter
                  </a>
                ) : null}
              </div>
            </nav>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
