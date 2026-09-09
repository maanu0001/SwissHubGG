import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Schutzprüfung für Server Actions.
 *
 * Jede aus einer `'use server'`-Datei exportierte Funktion ist ein von aussen
 * aufrufbarer Endpunkt. Dieser Test stellt sicher, dass jede davon die
 * Berechtigung prüft – mit genau zwei bewusst öffentlichen Ausnahmen.
 *
 * Damit fällt es sofort auf, wenn eine neue Aktion die Prüfung vergisst oder
 * eine reine Hilfsfunktion versehentlich in einer Action-Datei landet.
 */

const ACTIONS_DIR = path.join(process.cwd(), 'src/server/actions');

/** Bewusst ohne Berechtigungsprüfung – mit Begründung. */
const PUBLIC_ACTIONS: Record<string, string> = {
  submitContactRequest: 'Öffentliches Kontaktformular; geschützt durch Rate Limiting, Honeypot und Validierung.',
  logoutAction: 'Abmelden muss auch mit abgelaufener Sitzung möglich sein.',
};

type ExportedAction = { file: string; name: string; body: string };

function collectActions(): ExportedAction[] {
  const actions: ExportedAction[] = [];

  for (const file of readdirSync(ACTIONS_DIR)) {
    if (!file.endsWith('.ts')) continue;

    const source = readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
    if (!source.includes("'use server'")) continue;

    const pattern = /export async function (\w+)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source)) !== null) {
      const name = match[1];
      if (!name) continue;

      const rest = source.slice(match.index + match[0].length);
      const next = rest.search(/\nexport async function /);
      actions.push({ file, name, body: next === -1 ? rest : rest.slice(0, next) });
    }
  }

  return actions;
}

describe('Server Actions', () => {
  const actions = collectActions();

  it('findet die Action-Dateien', () => {
    expect(actions.length).toBeGreaterThan(30);
  });

  it('prüft in jeder Aktion die Berechtigung', () => {
    const unguarded = actions
      .filter((action) => !(action.name in PUBLIC_ACTIONS))
      .filter(
        (action) =>
          !action.body.includes('requirePermissionForAction') && !action.body.includes('requirePermission('),
      )
      .map((action) => `${action.file}: ${action.name}`);

    expect(unguarded, 'Server Actions ohne Berechtigungsprüfung').toEqual([]);
  });

  it('exportiert keine Nicht-Aktionen aus Action-Dateien', () => {
    // Reine Lesefunktionen gehören nach src/lib, sonst entstehen daraus
    // ungewollt öffentliche Endpunkte.
    const suspicious = actions
      .filter((action) => !action.name.endsWith('Action'))
      .filter((action) => !(action.name in PUBLIC_ACTIONS))
      .map((action) => `${action.file}: ${action.name}`);

    expect(suspicious, 'Exporte ohne "Action"-Endung in einer use-server-Datei').toEqual([]);
  });
});
