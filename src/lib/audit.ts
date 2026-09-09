import 'server-only';
import { prisma } from '@/lib/db';
import { hashIp } from '@/lib/crypto';
import type { CurrentUser } from '@/lib/auth/session';
import { requestIp } from '@/lib/auth/session';

/**
 * Revisionssicheres Protokoll administrativer Vorgänge.
 * Einträge werden ausschliesslich angelegt – es gibt keine Bearbeitungs- oder
 * Löschfunktion in der Anwendung.
 */

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_DENIED: 'auth.login.denied',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  SESSION_REVOKED: 'auth.session.revoked',
  CREATE: 'entity.create',
  UPDATE: 'entity.update',
  PUBLISH: 'entity.publish',
  UNPUBLISH: 'entity.unpublish',
  ARCHIVE: 'entity.archive',
  RESTORE: 'entity.restore',
  DELETE: 'entity.delete',
  DUPLICATE: 'entity.duplicate',
  ROLE_CHANGE: 'users.role.change',
  SETTINGS_CHANGE: 'settings.change',
  EMAIL_RECIPIENT_CHANGE: 'email.recipients.change',
  EMAIL_TEST: 'email.test',
  CONTACT_STATUS_CHANGE: 'contact.status.change',
  CONTACT_REPLY: 'contact.reply',
  CONTACT_ANONYMISE: 'contact.anonymise',
  CONTACT_EXPORT: 'contact.export',
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',
  MEDIA_REPLACE: 'media.replace',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

type AuditInput = {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  actor?: CurrentUser | null;
  actorLabel?: string;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.id ?? null,
        actorLabel: input.actorLabel ?? input.actor?.displayName ?? 'System',
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
        metadata: (input.metadata ?? undefined) as never,
        ipHash: hashIp(await requestIp().catch(() => null)),
      },
    });
  } catch (error) {
    // Ein fehlgeschlagenes Protokoll darf die eigentliche Aktion nicht abbrechen,
    // muss aber im Serverlog sichtbar sein.
    console.error('Audit-Eintrag konnte nicht geschrieben werden:', error);
  }
}

/** Variante ohne Request-Kontext (Hintergrundjobs). */
export async function recordSystemAudit(
  action: AuditAction,
  entityType: string,
  summary: string,
  metadata?: Record<string, unknown>,
  entityId?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorLabel: 'System',
        action,
        entityType,
        entityId: entityId ?? null,
        summary: summary.slice(0, 500),
        metadata: (metadata ?? undefined) as never,
      },
    });
  } catch (error) {
    console.error('System-Audit-Eintrag konnte nicht geschrieben werden:', error);
  }
}
