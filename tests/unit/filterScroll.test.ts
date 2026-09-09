import { describe, expect, it } from 'vitest';
import { FilterLink } from '@/components/site/FilterLink';
import { shouldResetScroll } from '@/lib/navigation/scrollReset';

/**
 * Ein Filterwechsel ist kein Seitenwechsel.
 *
 * Er darf weder die zentrale Scrolllogik auslösen noch den Router an den
 * Anfang der Ansicht scrollen lassen. Beide Zusicherungen werden hier
 * festgehalten – die eine an der Regel, die andere am Baustein, aus dem jeder
 * Filter entsteht.
 */

/** Die von der Komponente erzeugten Eigenschaften auslesen, ohne zu rendern. */
function propsOf(element: ReturnType<typeof FilterLink>): Record<string, unknown> {
  return (element as unknown as { props: Record<string, unknown> }).props;
}

describe('Zentrale Scrolllogik', () => {
  it('beginnt bei einem echten Pfadwechsel oben', () => {
    expect(shouldResetScroll({ from: '/', to: '/turniere' })).toBe(true);
    expect(shouldResetScroll({ from: '/turniere', to: '/partner' })).toBe(true);
    expect(shouldResetScroll({ from: '/partner', to: '/social' })).toBe(true);
    expect(shouldResetScroll({ from: '/social', to: '/kontakt' })).toBe(true);
  });

  it('reagiert nicht auf einen Filterwechsel innerhalb derselben Seite', () => {
    // `usePathname` enthält keine Suchparameter – der Pfad bleibt derselbe.
    expect(shouldResetScroll({ from: '/turniere', to: '/turniere' })).toBe(false);
    expect(shouldResetScroll({ from: '/social', to: '/social' })).toBe(false);
  });

  it('reagiert nicht auf einen Anker auf derselben Seite', () => {
    expect(shouldResetScroll({ from: '/turniere', to: '/turniere', hash: '#inhalt' })).toBe(false);
  });

  it('lässt einen Ankerlink auf die Startseite zum Abschnitt springen', () => {
    expect(shouldResetScroll({ from: '/turniere', to: '/', hash: '#community' })).toBe(false);
    // Ohne Anker gilt wieder der Seitenanfang.
    expect(shouldResetScroll({ from: '/turniere', to: '/', hash: '' })).toBe(true);
  });

  it('behält bei Zurück und Vorwärts die wiederhergestellte Position', () => {
    expect(shouldResetScroll({ from: '/turniere', to: '/partner', viaHistory: true })).toBe(false);
  });

  it('greift beim Erstaufruf nicht ein', () => {
    expect(shouldResetScroll({ from: null, to: '/turniere' })).toBe(false);
    expect(shouldResetScroll({ from: null, to: '/' })).toBe(false);
  });
});

describe('Filter als Link', () => {
  it('unterbindet das Scrollen des Routers', () => {
    // Ohne `scroll={false}` scrollt der Router nach der Navigation an den
    // Anfang der Ansicht – beim Filtern ist das der eigentliche Fehler.
    const props = propsOf(FilterLink({ href: '/turniere?status=laufend', active: false, children: 'Laufend' }));
    expect(props.scroll).toBe(false);
  });

  it('behält die Adresse mit Suchparameter bei', () => {
    const props = propsOf(FilterLink({ href: '/social?plattform=youtube', active: true, children: 'YouTube' }));
    expect(props.href).toBe('/social?plattform=youtube');
  });

  it('kennzeichnet die aktive Auswahl für Hilfstechnologien', () => {
    expect(propsOf(FilterLink({ href: '/turniere', active: true, children: 'Alle' }))['aria-current']).toBe('true');
    expect(propsOf(FilterLink({ href: '/turniere', active: false, children: 'Alle' }))['aria-current']).toBeUndefined();
  });

  it('unterscheidet den aktiven Zustand auch sichtbar', () => {
    const aktiv = String(propsOf(FilterLink({ href: '/x', active: true, children: 'A' })).className);
    const inaktiv = String(propsOf(FilterLink({ href: '/x', active: false, children: 'A' })).className);
    expect(aktiv).not.toBe(inaktiv);
    expect(aktiv).toContain('var(--color-brand)');
  });

  it('scrollt auch in der zweiten Filterebene nicht', () => {
    const props = propsOf(
      FilterLink({ href: '/turniere?spiel=valorant', active: false, children: 'Valorant', variant: 'tech' }),
    );
    expect(props.scroll).toBe(false);
    expect(String(props.className)).toContain('badge-tech');
  });
});
