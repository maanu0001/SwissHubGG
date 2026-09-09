# Designsystem

Leitidee: **«Swiss precision meets gaming energy.»** Sehr dunkle, abgestufte
Flächen, präzise Kanten, feine technische Raster – und `#83060A` als gezielt
gesetzte Markenfarbe, nicht als Fläche.

Alles Gestalterische liegt in `src/app/globals.css`; Komponenten verwenden
ausschliesslich die dort definierten Merkmale. Wer Farben, Abstände oder
Bewegung ändern will, ändert sie an dieser einen Stelle.

## Farben

| Ebene | Merkmal | Verwendung |
| --- | --- | --- |
| Flächen | `--color-void` → `--color-surface-hover` | fünf Stufen von tief nach hoch |
| Linien | `--color-line`, `--color-line-strong` | Kanten und Trennungen |
| Text | `--color-ink`, `--color-ink-muted`, `--color-ink-subtle` | drei Gewichtungen |
| Marke | `--color-brand`, `--color-brand-strong`, `--color-brand-bright`, `--color-brand-soft`, `--color-brand-text` | Aktionen, aktive Zustände, Akzentkanten |
| Status | `success`, `warning`, `danger`, `info` (je Fläche und Text) | Turnierstatus, Meldungen |
| Tech | `--color-tech`, `--color-tech-text` | kühler Akzent für technische Details |

Alle Kombinationen aus Text und Hintergrund erfüllen mindestens WCAG 2.2 AA.
Geprüft wird das mit einem automatisierten Kontrastlauf über alle öffentlichen
Seiten und die wichtigsten Dashboard-Seiten.

## Typografie

Eine einzige, lokal gehostete Schrift (Inter, variabel) plus die Systemschrift
für Monospace – kein zusätzlicher Download, keine Anfrage an Dritte.

- **Marketing:** `.display-1`, `.display-2` – `clamp()`-basiert, dadurch auf
  Smartphones keine überdimensionierten Zeilen.
- **Struktur:** `.heading-xl`, `.heading-lg`, `.heading-md` – ebenfalls fluid.
- **Fliesstext:** `.lead` (max. 62 Zeichen Zeilenlänge), `.muted`,
  `.prose-swisshub` für redaktionelles Markdown.
- **Interface und Meta:** `.meta`, `.meta-brand`, `.eyebrow` – Monospace,
  gesperrt, klein. Diese Ebene unterscheidet Bedien- und Metatexte deutlich
  vom Fliesstext.
- **Zahlen:** `.numeric` (tabellarische Ziffern), damit nichts springt.

## Flächen und Bausteine

`card`, `card-interactive`, `card-tech`, `panel`, `panel-glass`, `logo-plate`,
`badge-*`, `btn-*`, `input`/`select`, `skeleton`.

Dekorative Ebenen: `tech-grid`, `tech-grid-fine`, `tech-dots`, `glow-orb`
(+ `glow-brand`/`glow-tech`), `hairline`, `hairline-brand`, `connector`,
`corner-ticks`, `accent-line`, `pulse-dot`.

Gebündelt werden sie über:

- `TechBackdrop` (`hero` | `section` | `soft` | `panel`) – die
  Hintergrundkomposition.
- `SectionShell` und `SectionHeading` – gemeinsamer Rahmen für jeden Abschnitt,
  inklusive Abschnittsnummer und Verbindungslinie.
- `PageHero` – Kopfbereich aller Unterseiten.
- `LogoStage` – das Logo in einem technischen Rahmen.

## Bewegung

Die gesamte Bewegungslogik steckt in **einem** Inline-Skript
(`src/components/visual/MotionRuntime.tsx`, rund 1,5 KB, mit CSP-Nonce). Es
gibt dafür keine Animationsbibliothek und keine zusätzlichen Client
Components.

Das Skript übernimmt vier Aufgaben:

1. Einblenden beim Scrollen für alle `[data-reveal]`-Elemente.
2. Dekorative Ebenen (`[data-ambient]`) nur animieren, solange sie sichtbar sind.
3. Hochzählen echter, veröffentlichter Zahlen (`[data-countup]`).
4. Scroll-Zustand des Kopfbereichs (`data-scrolled` am `<html>`).

Grundsätze:

- **Ohne JavaScript ist alles sofort sichtbar.** Die Klasse `motion-ready` wird
  nur gesetzt, wenn das Skript läuft; die Ausgangsdarstellung im CSS ist
  immer der sichtbare Zustand.
- **`prefers-reduced-motion: reduce`** bricht das Skript sofort ab – es werden
  weder Beobachter angelegt noch Animationen gestartet.
- **Nur `transform` und `opacity`**, damit der Compositor arbeitet und keine
  Layout-Shifts entstehen.
- **Sicherheitsnetz:** Greift die Beobachtung nach drei Sekunden nicht, schaltet
  sich das Einblenden komplett ab (`motion-failsafe`), damit nie Inhalt
  unsichtbar bleibt.
- **Zahlen** zählen nur hoch, wenn der gepflegte Wert eine Zahl enthält; der
  Endzustand ist immer exakt der gepflegte Text. Es wird nie ein Wert erfunden.

Reveal wird über `revealProps(variant, index)` bzw. `<Reveal>` gesetzt – beides
Server-Komponenten, die lediglich ein Attribut und eine CSS-Variable ausgeben.

## Varianten im CMS

Die Redaktion arbeitet weiterhin innerhalb des Designsystems; es gibt keine
freien Design- oder HTML-Optionen. Die kontrollierte Variante ist die
Tonalität eines Abschnitts:

| Wert | Wirkung |
| --- | --- |
| `default` | normale Fläche |
| `muted` | abgesetzte Fläche mit Trennkanten |
| `accent` | Markenfläche für Höhepunkte |
| `tech` | dunkle, technische Fläche mit feinem Raster |

## Abschnittsnummerierung

Abschnitte mit eigener Überschrift tragen eine laufende Nummer. Blöcke, die
mangels Inhalt oder wegen eines abgeschalteten Schalters nichts ausgeben,
verbrauchen keine Nummer – geprüft wird das vorab über dieselben
zwischengespeicherten Abfragen, die der Block ohnehin verwendet
(`willRender` in `SectionRenderer.tsx`).

## Admin-Dashboard

Gleiche Farben, gleiche Typografie, deutlich weniger Bewegung: keine
Reveal-Animationen, keine dekorativen Ebenen ausser auf der Anmeldeseite.
Wichtiger als Effekte sind Übersicht und Bedienbarkeit – gerahmte Tabellen mit
Zeilen-Hover, klar abgesetzte Panel-Köpfe, Metatypografie für Spaltentitel und
eine Markenkante am aktiven Navigationseintrag.
