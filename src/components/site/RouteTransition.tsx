'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { HOME_PATH, INTRO_ATTRIBUTE, introState } from '@/lib/motion/intro';

/**
 * Zentrale Stelle für alles, was bei einem Seitenwechsel passieren muss.
 *
 * Beide Aufgaben brauchen dieselbe Information – die unmittelbar vorherige
 * Route – und müssen im selben Moment greifen, nämlich nach dem Einfügen der
 * neuen Seite und vor dem ersten Zeichnen. Deshalb liegen sie in einer
 * Komponente statt in zwei parallel laufenden Beobachtern.
 *
 * **1. Scrollposition zurücksetzen.** `html` trägt `scroll-behavior: smooth`,
 * damit Ankersprünge weich laufen. Dadurch wird aber auch das Zurücksetzen der
 * Scrollposition durch den Router zu einer Animation – die neue Seite öffnet
 * sich mitten im Inhalt und scrollt erst langsam nach oben. Eine noch laufende
 * weiche Scrollbewegung läuft sogar auf der neuen Seite weiter.
 *
 * - Nur bei einem echten Wechsel des Pfads, nicht bei Hash-Sprüngen oder
 *   Filterwechseln innerhalb derselben Seite. Der Sprunglink „Direkt zum
 *   Inhalt“ und die Ankerlinks der Startseite funktionieren dadurch unverändert.
 * - Führt ein Wechsel auf die Startseite und trägt die Adresse einen Anker,
 *   bleibt der Sprung zum Abschnitt erhalten – die Startseite behält ihr
 *   Abschnittsverhalten. Auf allen anderen Seiten wird immer oben begonnen.
 * - Bei „Zurück“ und „Vorwärts“ bleibt die vom Browser wiederhergestellte
 *   Position erhalten – das erwarten Besucherinnen und Besucher dort.
 *
 * **2. Einfluganimation freigeben oder unterdrücken.** Die Einblendungen sollen
 * den Wechsel von der Startseite in einen Bereich begleiten und danach nicht
 * mehr stören. Die Regel steckt in `shouldPlayIntro`; hier wird sie nur auf den
 * tatsächlichen Routenverlauf angewendet und als Attribut am `<html>`-Element
 * abgelegt. Der Erstaufruf ist bereits durch die Bewegungs-Laufzeit gesetzt,
 * die noch vor dem ersten Zeichnen läuft.
 *
 * Bewegungsempfindliche Einstellungen bleiben unberührt: Ein harter Sprung ist
 * bei `prefers-reduced-motion` ohnehin das gewünschte Verhalten, und die
 * Einfluganimation ist dort grundsätzlich abgeschaltet.
 */

/** Eigene Eingaben, die das Festhalten des Seitenanfangs sofort beenden. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** Vor dem Zeichnen ausführen, ohne bei der Server-Ausgabe zu warnen. */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function RouteTransition() {
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

    // Erstaufruf: Der Browser hat die Scrollposition bereits gesetzt – auch bei
    // einem geteilten Link mit Anker – und die Bewegungs-Laufzeit hat den
    // Zustand der Einfluganimation vor dem ersten Zeichnen festgelegt.
    if (previous === null) return;

    // Kein Seitenwechsel (z. B. nur ein Anker oder ein Suchparameter).
    if (previous === pathname) return;

    const root = document.documentElement;

    /*
      Einfluganimation: Der Zustand wird bei jedem Wechsel neu bestimmt, auch
      bei „Zurück“ und „Vorwärts“. Entscheidend ist ausschliesslich, welche
      Route unmittelbar zuvor angezeigt wurde – ein früherer Besuch der
      Startseite genügt ausdrücklich nicht.

      Das geschieht vor dem Zeichnen: Die neue Seite ist bereits im Dokument,
      aber noch nicht sichtbar. Wird abgeschaltet, gilt die Ausgangsdarstellung
      ohne Ausblendung – die Inhalte erscheinen sofort und vollständig.
    */
    root.setAttribute(
      INTRO_ATTRIBUTE,
      introState({ to: pathname, from: previous, reducedMotion: prefersReducedMotion() }),
    );

    // Zurück und Vorwärts: die wiederhergestellte Position bleibt bestehen.
    if (wasHistoryNavigation) return;

    // Einzige Ausnahme: ein Ankerlink auf die Startseite darf weiterhin zum
    // gewünschten Abschnitt springen.
    if (pathname === HOME_PATH && window.location.hash.length > 1) return;

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
