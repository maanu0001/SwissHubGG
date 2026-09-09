import Image from 'next/image';
import { Field } from '@/components/admin/ui';

/**
 * Auswahl eines Mediums in klassischen Formularen.
 *
 * Bewusst ein einfaches `<select>`: das Formular funktioniert damit auch ohne
 * JavaScript, und es wird kein zusätzlicher Client-Code geladen.
 */
type MediaSelectFieldProps = {
  label: string;
  name: string;
  media: { id: string; originalName: string; title: string | null; storageKey: string }[];
  defaultValue?: string | null;
  disabled?: boolean;
  hint?: string;
};

export function MediaSelectField({ label, name, media, defaultValue, disabled, hint }: MediaSelectFieldProps) {
  const selected = media.find((asset) => asset.id === defaultValue);

  return (
    <div className="flex items-start gap-4">
      {selected ? (
        <div className="relative mt-6 h-16 w-16 shrink-0 overflow-hidden rounded border border-[var(--color-line)]">
          <Image
            src={`/api/media/${selected.storageKey}`}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <Field label={label} name={name} hint={hint}>
          <select id={name} name={name} defaultValue={defaultValue ?? ''} disabled={disabled} className="select">
            <option value="">Kein Medium</option>
            {media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title ?? asset.originalName}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
