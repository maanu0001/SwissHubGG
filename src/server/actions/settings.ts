'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { CacheTag, invalidateAll, invalidateTags } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { communityStatSchema, parseSettingsPatch, updateSettings, type SiteSettings } from '@/lib/settings';
import { safeUrl } from '@/lib/sanitize';
import { normaliseBrandColor } from '@/lib/brandColor';
import { runSchedulerTick } from '@/lib/scheduler';
import {
  checkbox,
  failure,
  integer,
  optionalText,
  runAction,
  success,
  text,
  type ActionState,
} from '@/server/actions/types';

/** Globale Einstellungen, Community-Zahlen, Navigation, Team und Feature-Schalter. */

export async function updateSettingsGroupAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SETTINGS_MANAGE);
    const group = text(formData, 'group');

    const patch: Partial<SiteSettings> = {};

    /*
      Nur Felder übernehmen, die tatsächlich im Formular standen. Fehlt ein
      Schlüssel, bleibt der gespeicherte Wert unangetastet – eine Gruppe
      schreibt nie über eine andere hinweg.
    */
    const assignText = (key: keyof SiteSettings) => {
      if (!formData.has(key)) return;
      Object.assign(patch, { [key]: text(formData, key) });
    };
    const assignBool = (key: keyof SiteSettings) => {
      Object.assign(patch, { [key]: checkbox(formData, key) });
    };

    switch (group) {
      case 'allgemein': {
        assignText('siteName');
        assignText('motto');
        assignText('tagline');
        assignText('contactEmail');

        const discord = text(formData, 'discordInviteUrl');
        if (discord.length > 0 && !safeUrl(discord)) {
          return failure('Bitte prüfe die markierten Felder.', {
            discordInviteUrl: 'Bitte gib eine gültige Adresse an (https://discord.gg/…).',
          });
        }
        patch.discordInviteUrl = discord;
        break;
      }

      case 'rechtliches':
        assignText('legalEntityName');
        assignText('legalAddress');
        assignText('legalRepresentatives');
        assignText('legalRegisterInfo');
        break;

      case 'footer':
        assignText('footerText');
        assignText('footerNote');
        break;

      case 'footer-partner': {
        /*
          Ob der gewählte Partner öffentlich sichtbar ist, wird beim Anzeigen
          erneut geprüft. Hier wird nur sichergestellt, dass es ihn gibt –
          sonst bliebe eine Kennung stehen, die ins Leere zeigt.
        */
        const sponsorId = optionalText(formData, 'footerSponsorId');

        if (sponsorId) {
          const sponsor = await prisma.sponsor.findUnique({ where: { id: sponsorId }, select: { id: true } });
          if (!sponsor) {
            return failure('Bitte prüfe die markierten Felder.', {
              footerSponsorId: 'Dieser Partner wurde nicht gefunden.',
            });
          }
        }

        patch.footerSponsorId = sponsorId;
        break;
      }

      case 'darstellung': {
        const colour = normaliseBrandColor(text(formData, 'brandColor'));
        if (!colour) {
          return failure('Bitte prüfe die markierten Felder.', {
            brandColor: 'Bitte gib eine Farbe als Hexwert an, z. B. #83060A.',
          });
        }
        patch.brandColor = colour;
        break;
      }

      case 'seo':
        assignText('seoDefaultTitle');
        assignText('seoDefaultDescription');
        patch.seoDefaultImageId = optionalText(formData, 'seoDefaultImageId');
        break;

      case 'betrieb':
        assignBool('maintenanceMode');
        assignText('maintenanceMessage');
        break;

      case 'datenschutz':
        assignBool('cookieBannerEnabled');
        assignText('cookiePolicyVersion');
        break;

      case 'kontakt': {
        assignBool('contactAttachmentsEnabled');
        assignBool('contactConfirmationEnabled');
        assignBool('contactCaptchaEnabled');
        const retention = integer(formData, 'contactRetentionDays');
        patch.contactRetentionDays = retention ?? 730;
        break;
      }

      case 'email':
        assignText('mailFromName');
        assignText('mailReplyTo');
        break;

      case 'sponsoring':
        assignText('sponsorSectionLabel');
        assignBool('showSponsorTiers');
        break;

      default:
        return failure('Unbekannter Einstellungsbereich.');
    }

    const validation = parseSettingsPatch(patch);
    if (!validation.success) {
      return failure('Bitte prüfe die markierten Felder.', validation.fieldErrors);
    }

    // Erst schreiben, dann melden: Die Erfolgsmeldung erscheint ausschliesslich
    // nach einer bestätigten Transaktion.
    const written = await updateSettings(validation.data);

    await recordAudit({
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      entityType: 'GlobalSetting',
      summary: `Einstellungen im Bereich „${group}“ geändert.`,
      // Nur die Namen der geänderten Felder – niemals deren Inhalte.
      metadata: { group, keys: written },
      actor: user,
    });

    invalidateAll();
    revalidatePath('/', 'layout');
    return success('Die Einstellungen wurden gespeichert.');
  });
}

export async function updateCommunityStatsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SETTINGS_MANAGE);

    const ids = formData.getAll('statId').filter((entry): entry is string => typeof entry === 'string');
    const stats = ids
      .map((id) => ({
        id,
        label: text(formData, `label-${id}`),
        value: text(formData, `value-${id}`),
        description: text(formData, `description-${id}`),
        published: checkbox(formData, `published-${id}`),
      }))
      .filter((stat) => stat.label.length > 0 && stat.value.length > 0);

    const newLabel = text(formData, 'newLabel');
    const newValue = text(formData, 'newValue');

    // Eine halb ausgefüllte neue Zeile darf nicht kommentarlos verschwinden.
    if (newLabel.length > 0 !== newValue.length > 0) {
      return failure('Bitte prüfe die markierten Felder.', {
        [newValue.length === 0 ? 'newValue' : 'newLabel']:
          'Wert und Bezeichnung gehören zusammen – bitte beides ausfüllen.',
      });
    }

    if (newLabel.length > 0 && newValue.length > 0) {
      stats.push({
        id: randomUUID(),
        label: newLabel,
        value: newValue,
        description: text(formData, 'newDescription'),
        published: checkbox(formData, 'newPublished'),
      });
    }

    if (stats.length > 6) {
      return failure('Es können höchstens sechs Community-Zahlen gepflegt werden.');
    }

    // Auch diese Gruppe wird serverseitig geprüft – die Längenangaben im
    // Formular sind nur eine Bequemlichkeit, keine Absicherung.
    const validation = communityStatSchema.array().safeParse(stats);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const [index, field] = issue.path;
        const stat = typeof index === 'number' ? stats[index] : undefined;
        const key = stat && typeof field === 'string' ? `${field}-${stat.id}` : 'form';
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      return failure('Bitte prüfe die markierten Felder.', fieldErrors);
    }

    await updateSettings({ communityStats: validation.data });

    await recordAudit({
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      entityType: 'GlobalSetting',
      summary: `Community-Zahlen aktualisiert (${stats.filter((stat) => stat.published).length} veröffentlicht).`,
      actor: user,
    });

    invalidateAll();
    revalidatePath('/');
    return success('Die Community-Zahlen wurden gespeichert.');
  });
}

export async function toggleFeatureFlagAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SETTINGS_MANAGE);
    const key = text(formData, 'key');

    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return failure('Der Schalter wurde nicht gefunden.');

    await prisma.featureFlag.update({ where: { key }, data: { enabled: !flag.enabled } });

    await recordAudit({
      action: AUDIT_ACTIONS.SETTINGS_CHANGE,
      entityType: 'FeatureFlag',
      entityId: key,
      summary: `Feature-Schalter „${flag.label}“ ${flag.enabled ? 'deaktiviert' : 'aktiviert'}.`,
      actor: user,
    });

    invalidateTags(CacheTag.featureFlags);
    revalidatePath('/', 'layout');
    return success(`„${flag.label}“ ist jetzt ${flag.enabled ? 'deaktiviert' : 'aktiviert'}.`);
  });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export async function saveNavigationItemAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.NAVIGATION_MANAGE);

    const navigationKey = text(formData, 'navigationKey');
    const label = text(formData, 'label');
    const href = text(formData, 'href');

    if (label.length < 1) {
      return failure('Bitte prüfe die markierten Felder.', { label: 'Bitte gib eine Beschriftung an.' });
    }
    if (!safeUrl(href)) {
      return failure('Bitte prüfe die markierten Felder.', { href: 'Bitte gib ein gültiges Ziel an (z. B. /turniere).' });
    }

    const navigation = await prisma.navigation.findUnique({ where: { key: navigationKey }, select: { id: true } });
    if (!navigation) return failure('Das Menü wurde nicht gefunden.');

    const existingId = optionalText(formData, 'id');

    const data = {
      navigationId: navigation.id,
      label,
      href,
      position: integer(formData, 'position') ?? 0,
      visible: checkbox(formData, 'visible'),
      openInNewTab: checkbox(formData, 'openInNewTab'),
      highlight: checkbox(formData, 'highlight'),
    };

    if (existingId) {
      await prisma.navigationItem.update({ where: { id: existingId }, data });
    } else {
      await prisma.navigationItem.create({ data });
    }

    await recordAudit({
      action: existingId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
      entityType: 'NavigationItem',
      entityId: existingId ?? undefined,
      summary: `Menüpunkt „${label}“ im Menü „${navigationKey}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    invalidateTags(CacheTag.navigation);
    revalidatePath('/', 'layout');
    return success('Der Menüpunkt wurde gespeichert.');
  });
}

export async function deleteNavigationItemAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.NAVIGATION_MANAGE);
    const id = text(formData, 'id');

    const item = await prisma.navigationItem.findUnique({ where: { id }, select: { label: true } });
    if (!item) return failure('Der Menüpunkt wurde nicht gefunden.');

    await prisma.navigationItem.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'NavigationItem',
      entityId: id,
      summary: `Menüpunkt „${item.label}“ entfernt.`,
      actor: user,
    });

    invalidateTags(CacheTag.navigation);
    revalidatePath('/', 'layout');
    return success('Der Menüpunkt wurde entfernt.');
  });
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

export async function saveTeamMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);

    const name = text(formData, 'name');
    const role = text(formData, 'role');

    if (name.length < 2) return failure('Bitte prüfe die markierten Felder.', { name: 'Bitte gib einen Namen an.' });
    if (role.length < 2) return failure('Bitte prüfe die markierten Felder.', { role: 'Bitte gib eine Funktion an.' });

    const existingId = optionalText(formData, 'id');
    const published = checkbox(formData, 'published');

    const data = {
      name,
      role,
      description: optionalText(formData, 'description'),
      avatarId: optionalText(formData, 'avatarId'),
      sortOrder: integer(formData, 'sortOrder') ?? 0,
      active: checkbox(formData, 'active'),
      publishedAt: published ? new Date() : null,
    };

    if (existingId) {
      const current = await prisma.teamMember.findUnique({ where: { id: existingId }, select: { publishedAt: true } });
      await prisma.teamMember.update({
        where: { id: existingId },
        // Ein bereits veröffentlichter Eintrag behält sein Veröffentlichungsdatum.
        data: { ...data, publishedAt: published ? (current?.publishedAt ?? new Date()) : null },
      });
    } else {
      await prisma.teamMember.create({ data });
    }

    await recordAudit({
      action: existingId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
      entityType: 'TeamMember',
      entityId: existingId ?? undefined,
      summary: `Teammitglied „${name}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    invalidateTags(CacheTag.team);
    revalidatePath('/ueber-uns');
    return success('Das Teammitglied wurde gespeichert.');
  });
}

export async function deleteTeamMemberAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const id = text(formData, 'id');

    const member = await prisma.teamMember.findUnique({ where: { id }, select: { name: true } });
    if (!member) return failure('Das Teammitglied wurde nicht gefunden.');

    await prisma.teamMember.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'TeamMember',
      entityId: id,
      summary: `Teammitglied „${member.name}“ entfernt.`,
      actor: user,
    });

    invalidateTags(CacheTag.team);
    revalidatePath('/ueber-uns');
    return success('Das Teammitglied wurde entfernt.');
  });
}

// ---------------------------------------------------------------------------
// Weiterleitungen und Betrieb
// ---------------------------------------------------------------------------

export async function saveRedirectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SETTINGS_MANAGE);

    const source = text(formData, 'source');
    const destination = text(formData, 'destination');

    if (!source.startsWith('/') || source.startsWith('//')) {
      return failure('Bitte prüfe die markierten Felder.', { source: 'Die Quelle muss ein interner Pfad sein (/…).' });
    }
    if (!safeUrl(destination)) {
      return failure('Bitte prüfe die markierten Felder.', { destination: 'Bitte gib ein gültiges Ziel an.' });
    }

    await prisma.redirect.upsert({
      where: { source },
      create: {
        source,
        destination,
        statusCode: integer(formData, 'statusCode') === 307 ? 307 : 308,
        active: checkbox(formData, 'active'),
        note: optionalText(formData, 'note'),
      },
      update: {
        destination,
        statusCode: integer(formData, 'statusCode') === 307 ? 307 : 308,
        active: checkbox(formData, 'active'),
        note: optionalText(formData, 'note'),
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Redirect',
      summary: `Weiterleitung ${source} → ${destination} gespeichert.`,
      actor: user,
    });

    invalidateTags(CacheTag.redirects);
    revalidatePath('/admin/system');
    return success('Die Weiterleitung wurde gespeichert.');
  });
}

export async function deleteRedirectAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SETTINGS_MANAGE);
    const id = text(formData, 'id');

    const redirectRule = await prisma.redirect.findUnique({ where: { id }, select: { source: true } });
    if (!redirectRule) return failure('Die Weiterleitung wurde nicht gefunden.');

    await prisma.redirect.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'Redirect',
      entityId: id,
      summary: `Weiterleitung ${redirectRule.source} entfernt.`,
      actor: user,
    });

    invalidateTags(CacheTag.redirects);
    revalidatePath('/admin/system');
    return success('Die Weiterleitung wurde entfernt.');
  });
}

/** Führt den Hintergrundlauf sofort aus (terminierte Veröffentlichungen, E-Mail-Versand). */
export async function runSchedulerNowAction(): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.BACKUPS_MANAGE);
    const result = await runSchedulerTick();

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'System',
      summary: 'Hintergrundlauf manuell ausgelöst.',
      metadata: { ...result },
      actor: user,
    });

    revalidatePath('/admin/system');
    return success(
      `Durchlauf beendet: ${result.publishedPages} Seite(n) veröffentlicht, ${result.publishedRecords} weitere Inhalte freigeschaltet, ${result.mail.sent} E-Mail(s) versendet, ${result.mail.failed} fehlgeschlagen.`,
    );
  });
}
