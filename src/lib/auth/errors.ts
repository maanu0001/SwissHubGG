/**
 * Fehlerklasse für Berechtigungsprobleme.
 *
 * Bewusst in einem eigenen Modul ohne `server-only`: Sie wird auch von
 * Typdefinitionen genutzt, die im Client-Bundle landen. Die Klasse selbst
 * enthält keine serverseitige Logik.
 */
export class AuthorizationError extends Error {
  constructor(message = 'Für diese Aktion fehlt dir die Berechtigung.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
