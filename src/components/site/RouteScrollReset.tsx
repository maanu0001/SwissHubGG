'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Setzt die Scrollposition bei einem Seitenwechsel zurück.
 *
 * Hintergrund: `html` hat `scroll-behavior: smooth`, damit Ankersprünge weich
 * laufen. Dadurch wird aber auch das Zurücksetzen der Scrollposition durch den
 * Router zu einer Animation – die neue Seite öffnet sich mitten im Inhalt und
 * scrollt erst langsam nach oben. Eine noch laufende weiche Scrollbewegung
 * läuft sogar auf der neuen Seite weiter.
 *
 * Diese Komponente hängt einmal im Wurzel-Layout und greift zentral ein:
 *
 * - Nur bei einem echten Wechsel des Pfads, nicht bei Hash-Sprüngen oder
 *   Filterwechseln innerhalb derselben Seite. Der Sprunglink „Direkt zum
 *   Inhalt“ und die Ankerlinks der Startseite funktionieren dadurch unverändert.
 * - Führt ein Wechsel auf die Startseite und trägt die Adresse einen Anker,
 *   bleibt der Sprung zum Abschnitt erhalten – die Startseite behält ihr
 *   Abschnittsverhalten. Auf allen anderen Seiten wird immer oben begonnen.
 * - Bei „Zurück“ und „Vorwärts“ bleibt die vom Browser wiederhergestellte
 *   Position erhalten – das erwarten Besucherinnen und Besucher dort.
 * - Der Sprung erfolgt vor dem ersten Zeichnen und ohne Animation, damit weder
 *   ein Flackern noch ein sichtbares Hochscrollen entsteht.
 *
 * Bewegungsempfindliche Einstellungen bleiben unberührt: Ein harter Sprung ist
 * bei `prefers-reduced-motion` ohnehin das gewünschte Verhalten, und die
 * Einblendungen beim Scrollen laufen unverändert weiter.
 */

/** Eigene Eingaben, die das Festhalten des Seitenanfangs sofort beenden. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** Vor dem Zeichnen ausführen, ohne bei der Server-Ausgabe zu warnen. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RouteScrollReset() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);
  const cameFromHistory = useRef(false);

  // „Zurück“ und „Vorwärts“ merken: Diese Ereignisse laufen vor der
  // Aktualisierung des Pfads, der Hinweis liegt also rechtzeitig vor.
  useEffect(() => {
    const onPopState = () => {
      cameFromHistory.current = true;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useBeforePaint(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;

    const wasHistoryNavigation = cameFromHistory.current;
    cameFromHistory.current = false;

    // Erstaufruf: Der Browser hat die Position bereits gesetzt – auch bei
    // einem geteilten Link mit Anker.
    if (previous === null) return;

    // Kein Seitenwechsel (z. B. nur ein Anker oder ein Suchparameter).
    if (previous === pathname) return;

    // Zurück und Vorwärts: die wiederhergestellte Position bleibt bestehen.
    if (wasHistoryNavigation) return;

    // Einzige Ausnahme: ein Ankerlink auf die Startseite darf weiterhin zum
    // gewünschten Abschnitt springen.
    if (pathname === '/' && window.location.hash.length > 1) return;

    const root = document.documentElement;

    /*
      Weiches Scrollen für die Dauer des Seitenwechsels aussetzen.

      Nötig aus zwei Gründen: Eine noch laufende weiche Bewegung liefe sonst
      auf der neuen Seite weiter. Und der Router ruft unmittelbar nach dem
      Wechsel selbst `scrollIntoView()` auf den Abschnitten der neuen Seite auf
      – mit weichem Scrollen werden daraus mehrere Animationen, die einander
      überholen und mitten im Inhalt enden.

      Der ursprüngliche Wert wird kurz danach wieder gesetzt, damit Ankerlinks
      weiterhin weich scrollen.
    */
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });

    // Der Fokus lag auf dem angeklickten Link der alten Seite. Er wird
    // zurückgegeben, damit die Tastaturbedienung wieder am Seitenanfang
    // beginnt – beim nächsten Tabulator also beim Sprunglink. Die Ansage der
    // neuen Seite für Screenreader übernimmt der Router selbst.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }

    /*
      Eine bereits laufende weiche Scrollbewegung lässt sich nicht zuverlässig
      abbrechen: Sie setzt sich fort, sobald weiches Scrollen wieder erlaubt
      ist. Deshalb wird der Seitenanfang für die Dauer des Wechsels aktiv
      gehalten – ohne Animation und damit ohne sichtbare Bewegung.

      Sobald jemand selbst scrollt, endet das sofort: Die eigene Eingabe hat
      immer Vorrang.
    */
    let holding = true;
    let frame = 0;

    const stop = () => {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop);
      root.style.scrollBehavior = previousBehavior;
    };

    const holdTop = () => {
      if (!holding) return;
      if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      frame = requestAnimationFrame(holdTop);
    };

    const timer = window.setTimeout(stop, 400);
    frame = requestAnimationFrame(holdTop);
    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, { passive: true });

    return stop;
  }, [pathname]);

  return null;
}
