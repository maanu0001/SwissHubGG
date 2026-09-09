import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  colorSchemeOf,
  isTheme,
  otherTheme,
  resolveTheme,
  themeColorOf,
  themeToggleLabel,
} from '@/lib/theme';

/**
 * Die dunkle Darstellung ist der Standard und bleibt es. Sie darf weder von
 * der Systemeinstellung des Geräts noch von einem unbrauchbaren Cookie-Wert
 * überschrieben werden.
 */

describe('Standarddarstellung', () => {
  it('ist dunkel', () => {
    expect(DEFAULT_THEME).toBe('dark');
  });

  it('gilt ohne gespeicherte Wahl', () => {
    expect(resolveTheme(undefined)).toBe('dark');
    expect(resolveTheme(null)).toBe('dark');
    expect(resolveTheme('')).toBe('dark');
  });

  it('gilt auch bei einem unbrauchbaren Cookie-Wert', () => {
    for (const value of ['hell', 'system', 'auto', 'LIGHT', '<script>', 'true']) {
      expect(resolveTheme(value), `„${value}“ darf nicht greifen`).toBe('dark');
    }
  });
});

describe('Bewusste Auswahl', () => {
  it('schaltet auf die helle Darstellung um', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(otherTheme('dark')).toBe('light');
    expect(otherTheme('light')).toBe('dark');
  });

  it('bleibt beim erneuten Lesen des Cookies erhalten', () => {
    // Das ist der Weg, den auch der Server geht: Cookie lesen, auflösen.
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('wird lange genug gespeichert, um Sitzungen zu überdauern', () => {
    expect(THEME_COOKIE_MAX_AGE).toBeGreaterThanOrEqual(60 * 60 * 24 * 180);
  });

  it('verwendet einen eigenen, klar benannten Cookie-Namen', () => {
    expect(THEME_COOKIE).toBe('swisshub_theme');
  });
});

describe('Darstellung im Browser', () => {
  it('setzt color-scheme passend, damit Formularfelder und Leisten stimmen', () => {
    expect(colorSchemeOf('dark')).toBe('dark');
    expect(colorSchemeOf('light')).toBe('light');
  });

  it('meldet der Browserleiste den jeweiligen Seitengrund', () => {
    expect(themeColorOf('dark')).toBe('#0a0b10');
    expect(themeColorOf('light')).toBe('#f2f3f6');
    expect(themeColorOf('dark')).not.toBe(themeColorOf('light'));
  });

  it('erkennt gültige Werte', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe('Beschriftung der Umschaltfläche', () => {
  it('benennt immer das Ziel, nicht den Zustand', () => {
    expect(themeToggleLabel('dark')).toBe('Helles Design aktivieren');
    expect(themeToggleLabel('light')).toBe('Dunkles Design aktivieren');
  });
});
