# Designsystem

Leitidee: **«Swiss precision meets gaming energy.»** Sehr dunkle, abgestufte
Flächen, präzise Kanten, feine technische Raster – und `#83060A` als gezielt
gesetzte Markenfarbe, nicht als Fläche.

Die Gestaltung ist bewusst mutig: grosse Grössensprünge, asymmetrisch versetzte
Module, schräg angeschnittene Flächen, grosse halbtransparente Typografie im
Hintergrund und ein Hero, dessen Mittelpunkt die Bildmarke ist. Jeder Abschnitt
hat einen eigenen visuellen Charakter – die Startseite ist keine Reihe gleicher
Kartenraster.

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

## Dunkel und Hell

Es gibt zwei Darstellungen. **Dunkel ist der Standard** und bleibt es: Beim
ersten Besuch ist sie aktiv, unabhängig davon, wie das Betriebssystem
eingestellt ist – `prefers-color-scheme` wird für die Wahl bewusst nicht
ausgewertet. Erst eine bewusste Umschaltung aktiviert die helle Darstellung.

Die Wahl gehört der besuchenden Person, nicht der Website: Sie liegt in einem
eigenen Cookie (`swisshub_theme`, ein Jahr, `SameSite=Lax`) und ist keine
Einstellung im Dashboard. Niemand ändert damit die Darstellung für andere.

Umgesetzt ist sie ausschliesslich über die Merkmale oben. Die helle Fassung
definiert dieselben Namen neu (`html[data-theme='light']`) – es gibt kein
zweites Stylesheet, das auseinanderlaufen könnte. Nur wo eine Angabe an die
Dunkelheit gebunden ist, steht eine eigene Fassung: Schatten, Leuchtflächen,
Raster und der Kopfverlauf.

Sie ist keine Umkehrung des Dunkeldesigns, sondern eine eigene Abstimmung:
leicht kühl-neutrale Papierflächen statt Grau in Grau, `#83060A` unverändert
als Markenfarbe, ein etwas kräftigeres Raster (auf Weiss trägt es sonst nicht)
und deutlich zurückgenommene Leuchtflächen. Logos und Bilder werden nie
eingefärbt oder invertiert; Statusfarben behalten ihre Bedeutung und werden nur
für helle Untergründe nachgedunkelt.

Der Zustand steht bereits im ausgelieferten HTML: Das Wurzel-Layout liest das
Cookie und setzt `data-theme` sowie `color-scheme` am `<html>`. Dadurch gibt es
weder ein Aufblitzen der falschen Darstellung noch eine Abweichung zwischen
Server- und Client-Ausgabe – und es braucht kein Skript vor dem Zeichnen.
`generateViewport` meldet dazu die passende Farbe der Browserleiste.

Die Umschaltfläche (`ThemeToggle`) steht im Kopfbereich, im mobilen Menü und in
der Navigation des Dashboards. Sie ist eine gewöhnliche Schaltfläche –
vollständig per Tastatur bedienbar, mit `aria-pressed`, mit einer Beschriftung,
die immer das Ziel nennt („Helles Design aktivieren“), und mit Sonne und Mond
aus dem vorhandenen Symbolsatz. Massgeblich ist immer das Merkmal am `<html>`
(gelesen über `useSyncExternalStore`), deshalb zeigen alle Schaltflächen
denselben Zustand. Umgeschaltet wird ohne Neuaufbau der Seite; die Abmessungen
bleiben gleich, es entsteht kein Sprung im Layout.

## Typografie

Eine einzige, lokal gehostete Schrift (Inter, variabel) plus die Systemschrift
für Monospace – kein zusätzlicher Download, keine Anfrage an Dritte.

- **Marketing:** `.display-hero` (bis 5 rem), `.display-1`, `.display-2` –
  alle `clamp()`-basiert, dadurch auf Smartphones keine überdimensionierten
  Zeilen.
- **Hintergrundtypografie:** `.ghost-type` – ein grosses, nur konturiertes Wort
  je Abschnitt, das sich beim Scrollen langsamer bewegt.
- **Abschnittsnummer:** `.index-xl` – die Nummer ist ein eigenständiges
  gestalterisches Element in Markenkontur, nicht nur ein kleines Label.
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
`corner-ticks`, `accent-line`, `pulse-dot`, `orbit-ring`, `spotlight`.

Silhouette und Übergänge: `cut-top`, `cut-bottom`, `cut-both` schneiden einen
Abschnitt schräg an; `edge-diagonal` legt eine sichtbare diagonale Kante
zwischen zwei Flächen.

Gebündelt werden sie über:

- `HeroStage` – die Bildmarke im technischen Rahmen: Lichtkranz, zwei
  gegenläufige Ringe mit Knotenpunkten, Eckmarken und Raster. Die Marke selbst
  bleibt unverändert (gleiche Datei, festes Seitenverhältnis, keine Einfärbung);
  inszeniert wird ausschliesslich der Raum darum. Auf dem Desktop ist sie rund
  285 px gross, auf Smartphones rund 160 px.
- `TechBackdrop` (`hero` | `section` | `soft` | `panel`) – die
  Hintergrundkomposition.
- `SectionShell` und `SectionHeading` – gemeinsamer Rahmen für jeden Abschnitt,
  inklusive Abschnittsnummer und Verbindungslinie.
- `PageHero` – der gemeinsame Kopfbereich aller Unterseiten (siehe unten).
- `CmsPageHero` – dünne Schicht darüber für die Seiten aus dem
  Website-Builder.

## Kopfbereich der Unterseiten

Jede Seite ausser der Startseite beginnt mit demselben Kopfbereich. Er ist
**einmal** gestaltet, in `PageHero`: dunkler technischer Hintergrund mit feinem
Raster und rotem Lichtverlauf, kleines Kategorie-Label in Markenfarbe mit
Symbol, grosse weisse Überschrift (`display-hero`, `clamp()`), optionaler
Einleitungstext, waagrechte Akzentlinie in Markenfarbe und die schräg
angeschnittene Kante zum Inhalt (`edge-diagonal`). Abstände und Inhaltsbreite
kommen aus `shell`, das responsive Verhalten also ebenfalls.

Diese eine Komponente verwenden:

- die fest gebauten Seiten Turniere, Partner, Social Media und Kontakt,
- und über `CmsPageHero` **jede** im Website-Builder gepflegte Seite – die
  bestehenden ebenso wie jede künftig angelegte, im Entwurf, in der Vorschau
  und veröffentlicht.

Dafür braucht es kein neues CMS-Feld. Führt eine Seite bereits einen
Auftaktblock (`HERO`), liefert dieser die Angaben – Label, Hauptaussage, Text,
Motto und Schaltflächen wandern in den Kopfbereich, der Block wird nicht
zusätzlich ausgegeben (`splitPageHeader` in `src/lib/content/pageHeader.ts`).
Fehlt er, genügt der Seitentitel; ohne gepflegtes Label steht dort der Name der
Website, ohne Einleitung entfällt der Absatz ersatzlos. Es wird nichts
erfunden.

Die Startseite ist ausgenommen: Sie behält ihren eigenen, grossen Auftritt mit
der Bildmarke (`HeroSection`) und verwendet `PageHero` nicht.

## Bewegung

Die gesamte Bewegungslogik steckt in **einem** Inline-Skript
(`src/components/visual/MotionRuntime.tsx`, rund 2,5 KB, mit CSP-Nonce). Es
gibt dafür keine Animationsbibliothek und keine zusätzlichen Client
Components.

Das Skript übernimmt acht Aufgaben:

0. Zustand der Einfluganimation für den Erstaufruf festlegen (`data-intro` am
   `<html>`) – siehe „Einfluganimation“ weiter unten.
1. Einblenden beim Scrollen für alle `[data-reveal]`-Elemente.
2. Dekorative Ebenen (`[data-ambient]`) nur animieren, solange sie sichtbar sind.
3. Hochzählen echter, veröffentlichter Zahlen (`[data-countup]`).
4. Ebenen, die sich beim Scrollen langsamer bewegen (`[data-scroll-parallax]`).
5. Lichtfläche, die der Maus folgt (`[data-spotlight]`).
6. Maus-Parallaxe der Hero-Bühne (`[data-parallax-scene]`, Ebenen mit
   `[data-parallax-layer]` und eigener `--depth`).
7. Scroll-Zustand des Kopfbereichs (`data-scrolled` am `<html>`). Solange die
   mobile Navigation offen ist (`data-nav-open` am `<html>`), bleibt dieser
   Zustand unverändert – die Seite ist dann fixiert und meldet die Position 0.

Die Punkte 5 und 6 werden nur auf echten Zeigegeräten gebunden
(`hover: hover` und `pointer: fine`); auf Touch-Geräten entstehen dadurch
weder Ereignisse noch Kosten. Scroll- und Zeigerereignisse laufen passiv und
über genau einen `requestAnimationFrame`-Durchlauf.

### Die Reveal-Varianten

Nicht alles erscheint gleich – das ergibt den Rhythmus beim Scrollen:

| Variante | Wirkung | typischer Einsatz |
| --- | --- | --- |
| `up` | steigt auf | Fliesstext, Karten |
| `left` / `right` | seitlicher Einsatz | Abschnittsnummer, Labels, Spalten |
| `scale` | ruhiges Heranfahren | Panels, grosse Flächen |
| `fade` | nur Einblenden | kurze Zeilen |
| `mask` | Maske gibt die Zeile frei | Überschriften |
| `line` / `line-y` | Linie baut sich auf | Verbindungen, Trenner |
| `zoom` | Bild fährt aus der Überdeckung | Bilder |

Der Versatz innerhalb einer Gruppe kommt aus `revealProps(variante, position)`
und ist auf 420 ms gedeckelt, damit lange Listen nicht nachhinken.

**Wichtig bei `mask` und `zoom`:** Das beobachtete Element bleibt selbst
unbeschnitten; die Maske liegt als `overflow: hidden` darauf und bewegt wird
der Inhalt darin. Ein Beschnitt auf dem beobachteten Element würde seine
Schnittfläche auf null setzen – die Sichtbarkeitsbeobachtung würde dann nie
auslösen und der Inhalt dauerhaft unsichtbar bleiben.

### Grundsätze

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
  Endzustand ist immer exakt der gepflegte Text. Da die Laufzeit den Text
  verändert, trägt das Element `suppressHydrationWarning` – sonst könnte das
  Hochzählen mit der Hydration zusammenfallen.

### Einfluganimation

Die Einblendungen sind ein Auftritt, kein Dauerzustand: Sie begleiten den
Wechsel von der Startseite in einen Bereich und stören danach nicht mehr.
Entscheidend ist ausschliesslich die **unmittelbar vorherige** interne Route –
nicht der Verlauf, nicht ein Merker, nicht `document.referrer` und kein
sichtbarer Parameter in der Adresse.

| Weg | Einflug |
| --- | --- |
| Startseite → Unterseite | ja |
| Unterseite → Startseite | ja (die Startseite behält ihren Auftritt) |
| Unterseite → Unterseite | nein |
| Direktaufruf, Neuladen, neuer Tab, Verweis von aussen | nein |
| Zurück/Vorwärts, sofern der Schritt davor nicht die Startseite war | nein |
| Vorschau und Dashboard | nein |
| `prefers-reduced-motion: reduce` | nie |

Die Regel steht als reine Funktion in `src/lib/motion/intro.ts` und ist damit
prüfbar. Angewendet wird sie an genau zwei Stellen:

- **Erstaufruf:** die Bewegungs-Laufzeit setzt `data-intro` noch vor dem ersten
  Zeichnen – nur auf der Startseite auf `on`.
- **Seitenwechsel:** `RouteTransition` setzt das Attribut neu, nachdem die neue
  Seite im Dokument steht und bevor sie gezeichnet wird.

Das CSS blendet Inhalte **nur** bei `data-intro='on'` aus. Der ruhige Zustand
ist damit der Normalfall: Ohne das Attribut gibt es keinen unsichtbaren
Ausgangszustand, keine Verzögerung, kein Nachblenden und keine Verschiebung –
die Inhalte stehen unmittelbar vollständig da. Fortlaufende
Hintergrundbewegungen, Hover-Zustände und alle Interaktionen hängen nicht an
diesem Attribut und bleiben überall aktiv. Auch das Hochzählen von Zahlen
pausiert, solange der Einflug aus ist; der gepflegte Wert steht dann sofort da.

### Scrollposition beim Seitenwechsel

`html` trägt `scroll-behavior: smooth`, damit Ankersprünge weich laufen. Genau
das macht aber auch das Zurücksetzen der Scrollposition durch den Router zu
einer Animation – und der Router ruft nach einem Wechsel selbst
`scrollIntoView()` auf den Abschnitten der neuen Seite auf. Ohne Gegenmassnahme
öffnet sich eine Unterseite dadurch mitten im Inhalt und scrollt erst langsam
nach oben.

`RouteTransition` (einmal im Wurzel-Layout) löst das zentral – dieselbe
Komponente, die auch über die Einfluganimation entscheidet: Beide Aufgaben
brauchen die unmittelbar vorherige Route und müssen im selben Moment greifen.

- Nur bei einem echten Wechsel des Pfads – Ankersprünge, der Sprunglink und
  Filterwechsel auf derselben Seite bleiben unberührt.
- Weiches Scrollen wird für die Dauer des Wechsels ausgesetzt und der
  Seitenanfang aktiv gehalten; eine bereits laufende weiche Bewegung würde
  sonst weiterlaufen, sobald sie wieder erlaubt ist.
- Eigene Eingaben (Rad, Berührung, Taste, Zeiger) beenden das Festhalten
  sofort.
- Bei „Zurück“ und „Vorwärts“ bleibt die wiederhergestellte Position bestehen.
- Ein Ankerlink auf die Startseite springt weiterhin zum Abschnitt.

### Mobile Navigation

Das Panel richtet sich nach `100dvh`, also nach dem tatsächlich sichtbaren
Bereich. Mit `inset-0` würde es der Layout-Ansicht folgen – die ist auf
Mobilgeräten höher als der sichtbare Bereich, sobald die Browserleiste
eingeblendet ist, und der untere Teil des Menüs läge dahinter.

- Kopf- und Fusszeile bleiben stehen (`shrink-0`) und halten über
  `env(safe-area-inset-top/bottom)` Abstand zu den Systemleisten; gescrollt
  wird bei zu geringer Höhe nur die Liste dazwischen.
- Der Hintergrund wird über einen fixierten Body festgehalten – `overflow:
  hidden` allein genügt nicht, weil das Wurzelelement scrollt. Die Position
  stammt aus dem Moment des Antippens, weil die Fixierung die Dokumenthöhe im
  selben Bild kappt.
- Weil der Browser bei fixiertem Body die Position 0 meldet, setzt das Panel
  `data-nav-open` am `<html>`; ohne dieses Merkmal würde der Kopfbereich hinter
  dem Menü wieder wachsen und die Seite beim Schliessen verschieben.
- Ab 768 px übernimmt die Navigation im Kopfbereich. Wird diese Breite beim
  Drehen erreicht, schliesst das Panel selbst, damit weder eine unsichtbare
  Ebene noch die Scrollsperre zurückbleibt.

### Interaktion

Karten heben sich an, neigen sich leicht, ziehen eine Akzentlinie auf und
erhalten eine sehr dezente Lichtfläche an der Mausposition. Schaltflächen
haben Druckfeedback, einen einmal durchlaufenden Lichtstreifen und einen
mitgehenden Pfeil. Alle Zustände sind zusätzlich über Fokus erreichbar; auf
Touch-Geräten bleibt jede Funktion ohne Hover verständlich.

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
