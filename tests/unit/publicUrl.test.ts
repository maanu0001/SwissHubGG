import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { internalUrl, publicOrigin, safeInternalPath } from '@/lib/publicUrl';

/**
 * Öffentliche Adressen dürfen nie aus der Adresse entstehen, unter der die
 * Anwendung die Anfrage entgegengenommen hat. Hinter dem Reverse Proxy ist das
 * die interne – im Zweifel die Bind-Adresse `0.0.0.0`.
 */

const ursprung = { ...process.env };

beforeEach(() => {
  // Pflichtangaben der Umgebung, damit nur die Adresslogik geprüft wird.
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-1234';
  resetEnvCache();
});

afterEach(() => {
  process.env = { ...ursprung };
  resetEnvCache();
});

function mitKopf(kopf: Record<string, string> = {}): Headers {
  return new Headers(kopf);
}

describe('Öffentlicher Ursprung', () => {
  it('kommt aus APP_URL', () => {
    process.env.APP_URL = 'https://swisshub.gg';
    expect(publicOrigin()).toBe('https://swisshub.gg');
  });

  it('ignoriert den vom Proxy gemeldeten Host, solange APP_URL öffentlich ist', () => {
    process.env.APP_URL = 'https://swisshub.gg';
    expect(publicOrigin(mitKopf({ 'x-forwarded-host': 'angreifer.example' }))).toBe('https://swisshub.gg');
    expect(publicOrigin(mitKopf({ host: '0.0.0.0:3000' }))).toBe('https://swisshub.gg');
  });

  it('weicht auf den Proxy-Host aus, wenn APP_URL auf eine Bind-Adresse zeigt', () => {
    // Kann nur passieren, wenn APP_URL auf dem Server fehlt; die Bind-Adresse
    // darf trotzdem nie ausgeliefert werden.
    process.env.APP_URL = 'http://localhost:3000';
    process.env.TRUST_PROXY = 'true';

    expect(publicOrigin(mitKopf({ 'x-forwarded-host': 'swisshub.gg', 'x-forwarded-proto': 'https' })))
      .toBe('https://swisshub.gg');
  });

  it('vertraut dem Proxy-Host nicht, wenn TRUST_PROXY aus ist', () => {
    process.env.APP_URL = 'http://localhost:3000';
    process.env.TRUST_PROXY = 'false';

    expect(publicOrigin(mitKopf({ 'x-forwarded-host': 'angreifer.example' }))).toBe('http://localhost:3000');
  });

  it('lässt eine Bind-Adresse gar nicht erst als APP_URL zu', () => {
    process.env.APP_URL = 'http://0.0.0.0:3000';
    expect(() => publicOrigin()).toThrow(/Bind-Adresse/);
  });
});

describe('Interne Pfade', () => {
  it('lässt gewöhnliche Pfade durch', () => {
    expect(safeInternalPath('/admin/turniere')).toBe('/admin/turniere');
    expect(safeInternalPath('/admin?a=1#b')).toBe('/admin?a=1#b');
  });

  it('verwirft alles, was auf eine fremde Domain zeigen könnte', () => {
    for (const wert of [
      'https://fremde-domain.example/uebernahme',
      '//fremde-domain.example',
      '/\\fremde-domain.example',
      'javascript:alert(1)',
      'admin',
      '',
      null,
      undefined,
    ]) {
      expect(safeInternalPath(wert, '/admin'), String(wert)).toBe('/admin');
    }
  });

  it('verwirft Steuerzeichen, die den Location-Kopf aufbrechen könnten', () => {
    expect(safeInternalPath('/admin\r\nSet-Cookie: a=b', '/')).toBe('/');
  });

  it('baut die vollständige Adresse aus der öffentlichen Domain', () => {
    process.env.APP_URL = 'https://swisshub.gg';
    expect(internalUrl('/admin', undefined, '/').toString()).toBe('https://swisshub.gg/admin');
    // Ein fremdes Ziel landet auf dem Rückfallpfad, nicht auf der fremden Domain.
    expect(internalUrl('https://fremde-domain.example', undefined, '/admin').toString())
      .toBe('https://swisshub.gg/admin');
  });
});
