/**
 * Katalog aller Berechtigungen und der ausgelieferten Standardrollen.
 * Dieser Katalog ist die einzige Quelle der Wahrheit; der Seed gleicht die
 * Datenbank damit ab, ohne bestehende Zuweisungen zu zerstören.
 */

export const PERMISSIONS = {
  PAGES_VIEW: 'pages.view',
  PAGES_EDIT: 'pages.edit',
  PAGES_PUBLISH: 'pages.publish',
  PAGES_DELETE: 'pages.delete',
  NAVIGATION_MANAGE: 'navigation.manage',
  MEDIA_VIEW: 'media.view',
  MEDIA_MANAGE: 'media.manage',
  TOURNAMENTS_VIEW: 'tournaments.view',
  TOURNAMENTS_MANAGE: 'tournaments.manage',
  TOURNAMENTS_PUBLISH: 'tournaments.publish',
  SPONSORS_VIEW: 'sponsors.view',
  SPONSORS_MANAGE: 'sponsors.manage',
  SOCIAL_ACCOUNTS_MANAGE: 'social.accounts.manage',
  SOCIAL_POSTS_MANAGE: 'social.posts.manage',
  CONTACT_READ: 'contact.read',
  CONTACT_RESPOND: 'contact.respond',
  CONTACT_DELETE: 'contact.delete',
  CONTACT_EXPORT: 'contact.export',
  EMAIL_RECIPIENTS_MANAGE: 'email.recipients.manage',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
  BACKUPS_MANAGE: 'backups.manage',
  METRICS_VIEW: 'metrics.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

type PermissionDefinition = {
  key: PermissionKey;
  name: string;
  description: string;
  group: string;
  sortOrder: number;
};

export const PERMISSION_CATALOGUE: PermissionDefinition[] = [
  { key: PERMISSIONS.PAGES_VIEW, name: 'Seiten ansehen', description: 'Seiten und Entwürfe im Dashboard einsehen.', group: 'Inhalte', sortOrder: 10 },
  { key: PERMISSIONS.PAGES_EDIT, name: 'Seiten bearbeiten', description: 'Seiteninhalte und Abschnitte als Entwurf bearbeiten.', group: 'Inhalte', sortOrder: 20 },
  { key: PERMISSIONS.PAGES_PUBLISH, name: 'Seiten veröffentlichen', description: 'Entwürfe veröffentlichen, terminieren und zurückziehen.', group: 'Inhalte', sortOrder: 30 },
  { key: PERMISSIONS.PAGES_DELETE, name: 'Seiten archivieren', description: 'Seiten archivieren oder endgültig entfernen.', group: 'Inhalte', sortOrder: 40 },
  { key: PERMISSIONS.NAVIGATION_MANAGE, name: 'Navigation verwalten', description: 'Menüpunkte in Kopf- und Fussbereich pflegen.', group: 'Inhalte', sortOrder: 50 },

  { key: PERMISSIONS.MEDIA_VIEW, name: 'Medien ansehen', description: 'Medienbibliothek einsehen.', group: 'Medien', sortOrder: 10 },
  { key: PERMISSIONS.MEDIA_MANAGE, name: 'Medien verwalten', description: 'Medien hochladen, bearbeiten und löschen.', group: 'Medien', sortOrder: 20 },

  { key: PERMISSIONS.TOURNAMENTS_VIEW, name: 'Turniere ansehen', description: 'Turniere im Dashboard einsehen.', group: 'Turniere', sortOrder: 10 },
  { key: PERMISSIONS.TOURNAMENTS_MANAGE, name: 'Turniere verwalten', description: 'Turniere anlegen, bearbeiten, Teams und Ergebnisse pflegen.', group: 'Turniere', sortOrder: 20 },
  { key: PERMISSIONS.TOURNAMENTS_PUBLISH, name: 'Turniere veröffentlichen', description: 'Turniere veröffentlichen, terminieren und archivieren.', group: 'Turniere', sortOrder: 30 },

  { key: PERMISSIONS.SPONSORS_VIEW, name: 'Sponsoren ansehen', description: 'Sponsoren und Partner einsehen.', group: 'Sponsoring', sortOrder: 10 },
  { key: PERMISSIONS.SPONSORS_MANAGE, name: 'Sponsoren verwalten', description: 'Sponsoren, Stufen und Zuordnungen pflegen.', group: 'Sponsoring', sortOrder: 20 },

  { key: PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE, name: 'Social Accounts verwalten', description: 'Plattform-Accounts und Profillinks pflegen.', group: 'Social Media', sortOrder: 10 },
  { key: PERMISSIONS.SOCIAL_POSTS_MANAGE, name: 'Social Posts verwalten', description: 'Kuratierte Beiträge pflegen und hervorheben.', group: 'Social Media', sortOrder: 20 },

  { key: PERMISSIONS.CONTACT_READ, name: 'Kontaktanfragen lesen', description: 'Anfragen in der Inbox einsehen.', group: 'Kontakt', sortOrder: 10 },
  { key: PERMISSIONS.CONTACT_RESPOND, name: 'Kontaktanfragen beantworten', description: 'Status ändern, Notizen erfassen und antworten.', group: 'Kontakt', sortOrder: 20 },
  { key: PERMISSIONS.CONTACT_DELETE, name: 'Kontaktanfragen löschen', description: 'Anfragen anonymisieren oder löschen.', group: 'Kontakt', sortOrder: 30 },
  { key: PERMISSIONS.CONTACT_EXPORT, name: 'Kontaktanfragen exportieren', description: 'Anfragen als CSV exportieren.', group: 'Kontakt', sortOrder: 40 },
  { key: PERMISSIONS.EMAIL_RECIPIENTS_MANAGE, name: 'E-Mail-Empfänger verwalten', description: 'Benachrichtigungsempfänger und Vorlagen pflegen.', group: 'Kontakt', sortOrder: 50 },

  { key: PERMISSIONS.USERS_MANAGE, name: 'Benutzer und Rollen verwalten', description: 'Zugänge, Rollen und Berechtigungen vergeben.', group: 'Administration', sortOrder: 10 },
  { key: PERMISSIONS.SETTINGS_MANAGE, name: 'Einstellungen verwalten', description: 'Globale Einstellungen und Feature-Schalter ändern.', group: 'Administration', sortOrder: 20 },
  { key: PERMISSIONS.AUDIT_VIEW, name: 'Audit-Log ansehen', description: 'Protokoll administrativer Änderungen einsehen.', group: 'Administration', sortOrder: 30 },
  { key: PERMISSIONS.BACKUPS_MANAGE, name: 'Backups verwalten', description: 'Backup-Status einsehen und Hinweise pflegen.', group: 'Administration', sortOrder: 40 },
  { key: PERMISSIONS.METRICS_VIEW, name: 'Statistiken ansehen', description: 'Website-Statistiken im Dashboard einsehen.', group: 'Administration', sortOrder: 50 },
];

type RoleDefinition = {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  permissions: PermissionKey[];
};

const ALL_PERMISSIONS = PERMISSION_CATALOGUE.map((item) => item.key);

export const ROLE_CATALOGUE: RoleDefinition[] = [
  {
    key: 'superadmin',
    name: 'Superadmin',
    description: 'Uneingeschränkter Zugriff inklusive Benutzerverwaltung und Systemeinstellungen.',
    sortOrder: 10,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'administrator',
    name: 'Administrator',
    description: 'Verwaltet Inhalte, Turniere, Sponsoren, Social Media und Kontaktanfragen.',
    sortOrder: 20,
    permissions: ALL_PERMISSIONS.filter((key) => key !== PERMISSIONS.USERS_MANAGE),
  },
  {
    key: 'redaktion',
    name: 'Website-Redaktion',
    description: 'Pflegt Seiteninhalte, Navigation und Medien.',
    sortOrder: 30,
    permissions: [
      PERMISSIONS.PAGES_VIEW,
      PERMISSIONS.PAGES_EDIT,
      PERMISSIONS.PAGES_PUBLISH,
      PERMISSIONS.NAVIGATION_MANAGE,
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.MEDIA_MANAGE,
      PERMISSIONS.TOURNAMENTS_VIEW,
      PERMISSIONS.SPONSORS_VIEW,
      PERMISSIONS.METRICS_VIEW,
    ],
  },
  {
    key: 'turnierverwaltung',
    name: 'Turnierverwaltung',
    description: 'Plant und pflegt Turniere inklusive Teams, Ergebnissen und Medien.',
    sortOrder: 40,
    permissions: [
      PERMISSIONS.TOURNAMENTS_VIEW,
      PERMISSIONS.TOURNAMENTS_MANAGE,
      PERMISSIONS.TOURNAMENTS_PUBLISH,
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.MEDIA_MANAGE,
      PERMISSIONS.SPONSORS_VIEW,
      PERMISSIONS.PAGES_VIEW,
      PERMISSIONS.METRICS_VIEW,
    ],
  },
  {
    key: 'sponsoring',
    name: 'Sponsoring',
    description: 'Verwaltet Sponsoren, Partner und Sponsoring-Stufen.',
    sortOrder: 50,
    permissions: [
      PERMISSIONS.SPONSORS_VIEW,
      PERMISSIONS.SPONSORS_MANAGE,
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.MEDIA_MANAGE,
      PERMISSIONS.TOURNAMENTS_VIEW,
      PERMISSIONS.METRICS_VIEW,
    ],
  },
  {
    key: 'social-media',
    name: 'Social Media',
    description: 'Pflegt Plattform-Accounts und kuratierte Beiträge.',
    sortOrder: 60,
    permissions: [
      PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE,
      PERMISSIONS.SOCIAL_POSTS_MANAGE,
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.MEDIA_MANAGE,
      PERMISSIONS.METRICS_VIEW,
    ],
  },
  {
    key: 'kontaktverwaltung',
    name: 'Kontaktverwaltung',
    description: 'Bearbeitet Kontaktanfragen und pflegt Benachrichtigungsempfänger.',
    sortOrder: 70,
    permissions: [
      PERMISSIONS.CONTACT_READ,
      PERMISSIONS.CONTACT_RESPOND,
      PERMISSIONS.CONTACT_DELETE,
      PERMISSIONS.CONTACT_EXPORT,
      PERMISSIONS.EMAIL_RECIPIENTS_MANAGE,
      PERMISSIONS.METRICS_VIEW,
    ],
  },
  {
    key: 'readonly',
    name: 'Nur Lesen',
    description: 'Einsicht ohne Änderungsrechte.',
    sortOrder: 80,
    permissions: [
      PERMISSIONS.PAGES_VIEW,
      PERMISSIONS.MEDIA_VIEW,
      PERMISSIONS.TOURNAMENTS_VIEW,
      PERMISSIONS.SPONSORS_VIEW,
      PERMISSIONS.CONTACT_READ,
      PERMISSIONS.METRICS_VIEW,
    ],
  },
];

/** Gruppiert den Katalog für die Darstellung in der Rollenverwaltung. */
export function permissionGroups(): { group: string; permissions: PermissionDefinition[] }[] {
  const groups = new Map<string, PermissionDefinition[]>();
  for (const permission of PERMISSION_CATALOGUE) {
    const list = groups.get(permission.group) ?? [];
    list.push(permission);
    groups.set(permission.group, list);
  }
  return [...groups.entries()].map(([group, permissions]) => ({
    group,
    permissions: permissions.sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
