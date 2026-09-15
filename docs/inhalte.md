# Inhalte pflegen

Anleitung für Redaktion und Administration. Es sind keine Programmierkenntnisse
nötig.

## Anmelden

`https://swisshub.gg/admin` aufrufen und **Mit Discord anmelden** wählen. Der
Link wird bewusst nicht auf der Website beworben.

Sichtbar sind nur die Bereiche, für die Rechte vorliegen. Fehlt etwas, wendet
man sich an einen Superadmin.

## Was nach der Installation noch fehlt

Diese Angaben kennt nur die Community selbst; sie sind deshalb nicht
vorbelegt. Das Dashboard zeigt auf der Startseite an, was noch offen ist.

| Angabe | Ort | Auswirkung, solange es fehlt |
|---|---|---|
| Discord-Einladungslink | Einstellungen → Allgemein | Alle Discord-Schaltflächen bleiben verborgen |
| Adresse des Vereins | Einstellungen → Impressum & Verein | Das Impressum ist unvollständig |
| Vertretungsberechtigte Personen | Einstellungen → Impressum & Verein | Das Impressum ist unvollständig |
| Community-Zahlen | Einstellungen → Community-Zahlen | Der Statistikbereich wird ausgelassen |
| Social-Media-Accounts | Social Media | Kanäle und Footer-Symbole fehlen |
| Sponsoren | Sponsoren | Der Partnerbereich zeigt einen erklärenden Hinweis |
| Turniere | Turniere | Die Turnierseite zeigt einen erklärenden Hinweis |

Die Website bleibt in jedem Fall funktionsfähig: Leere Bereiche zeigen einen
verständlichen Hinweis statt Platzhaltern oder erfundenen Werten.

## Seiten bearbeiten

### Grundprinzip

Jede Seite hat zwei Stände:

- **Entwurf** – der Arbeitsstand im Builder. Nur intern sichtbar.
- **Veröffentlicht** – der Stand, den Besucher sehen.

Änderungen wirken sich erst nach dem Klick auf **Veröffentlichen** auf die
Website aus. Bis dahin lässt sich beliebig ausprobieren.

### Website-Builder

*Seiten → Seite auswählen*

- **Links** die Liste der Abschnitte. Die Reihenfolge lässt sich per
  Ziehen ändern oder über die Pfeile ↑ ↓ (auch mit der Tastatur bedienbar).
- **Rechts** die Eingabefelder des ausgewählten Abschnitts.
- Änderungen werden nach kurzer Pause automatisch gespeichert. Der Status steht
  unter der Abschnittsliste: *Alle Änderungen gespeichert*, *Nicht gespeicherte
  Änderungen …* oder eine Fehlermeldung.
- **Vorschau** zeigt den Entwurf so, wie er nach dem Veröffentlichen aussieht –
  wahlweise in der Desktop-, Tablet- oder Mobilansicht.

### Verfügbare Abschnitte

| Abschnitt | Wofür |
|---|---|
| Hero | Grosser Einstiegsbereich mit Titel, Motto und Buttons |
| Text | Einfacher Textabschnitt |
| Rich Text | Formatierter Text mit Zwischentiteln, Listen und Links |
| Bild | Einzelnes Bild aus der Medienbibliothek |
| Bildergalerie | Mehrere Bilder im Raster |
| Video | YouTube oder Twitch – wird erst auf Klick geladen |
| Call to Action | Hervorgehobener Aufruf, z. B. zum Discord |
| Kartenraster | Mehrere Karten mit Symbol, Titel und Text |
| Statistiken | Community-Zahlen aus den Einstellungen oder eigene Werte |
| FAQ | Aufklappbare Fragen und Antworten |
| Logo-/Partnerleiste | Kompakte Leiste mit Sponsorenlogos |
| Social-Media-Highlights | Kuratierte Beiträge |
| Turnierliste | Turniere nach Status – aktualisiert sich automatisch |
| Sponsorenliste | Sponsoren mit Logo und Beschreibung |
| Teammitglieder | Vorstand oder Team |
| Abstand / Trenner | Freiraum oder eine dezente Trennlinie |
| Zwei Spalten | Frei konfigurierbare Sektion mit zwei Spalten |

Farben, Schriften und Abstände sind fest im SwissHub-Designsystem hinterlegt.
Das ist Absicht: So bleibt das Erscheinungsbild einheitlich, egal wer bearbeitet.

### Formatierung im Rich Text

```markdown
## Zwischentitel
### Kleinerer Zwischentitel

**fett**   *kursiv*

- Listenpunkt
- Noch einer

1. Nummerierte Liste
2. Zweiter Punkt

[Beschriftung](/turniere)
[Externer Link](https://example.com)

> Hervorgehobenes Zitat
```

Externe Links erhalten automatisch die passenden Sicherheitsattribute.

### Platzhalter für gepflegte Angaben

In Text- und Rich-Text-Abschnitten lassen sich zentrale Angaben einsetzen. Das
lohnt sich bei Impressum und Datenschutz: Ändert sich die Adresse, genügt eine
Anpassung in den Einstellungen.

| Platzhalter | Inhalt |
|---|---|
| `{{siteName}}` | Website-Name |
| `{{motto}}` | Motto |
| `{{kontaktEmail}}` | Kontaktadresse |
| `{{vereinsname}}` | Name des Vereins |
| `{{adresse}}` | Adresse des Vereins |
| `{{vertretung}}` | Vertretungsberechtigte Personen |
| `{{register}}` | Registerangaben |

Als Ziel eines Buttons funktioniert ausserdem `{discord}`. Damit wird immer der
in den Einstellungen gepflegte Einladungslink verwendet. Ist keiner hinterlegt,
wird die Schaltfläche ausgelassen statt ins Leere zu führen.

### Veröffentlichen und terminieren

- **Veröffentlichen** überträgt den Entwurf auf die Website und legt zugleich
  eine Version an.
- **Veröffentlichen am** stellt eine Veröffentlichung in die Zukunft. Der
  Hintergrundlauf erledigt sie automatisch.
- **Deaktivieren am** nimmt die Seite zu einem Zeitpunkt wieder herunter.
- **Von der Website nehmen** entfernt sie sofort; der Entwurf bleibt erhalten.

### Versionen

*Seite → Versionen*: Jede Veröffentlichung ist archiviert, mit Zeitpunkt,
Person und einer Übersicht der Änderungen gegenüber der Vorversion.

**Wiederherstellen** schreibt einen früheren Stand in den Entwurf zurück. Die
Website ändert sich dadurch noch nicht – erst durch erneutes Veröffentlichen.
So lässt sich der wiederhergestellte Stand vorher in Ruhe prüfen.

### URL ändern

Beim Ändern der URL einer Seite wird automatisch eine Weiterleitung von der
alten Adresse angelegt. Bestehende Links und Suchergebnisse führen weiterhin
zum Ziel. Die Weiterleitungen stehen unter *System*.

### Links prüfen

Auf der Seitenbearbeitung erledigt **Links prüfen** eine Kontrolle aller Links
des Entwurfs: interne Ziele gegen die vorhandenen Seiten und Turniere, externe
mit einer einmaligen Anfrage. Die Prüfung läuft nur auf Knopfdruck, damit keine
dauernde Last bei anderen Anbietern entsteht.

## Turniere

*Turniere → Neues Turnier*

Ein Turnier entsteht als Entwurf und ist erst nach **Veröffentlichen**
öffentlich sichtbar.

### Statuswerte

| Status | Bedeutung |
|---|---|
| Entwurf | in Arbeit, nicht öffentlich |
| Angekündigt | öffentlich, Anmeldung noch nicht offen |
| Anmeldung offen | Anmeldung läuft – der Anmelde-Button wird hervorgehoben |
| Anmeldung geschlossen | Teilnehmerfeld steht fest |
| Läuft | Turnier findet gerade statt |
| Abgeschlossen | beendet, mit Ergebnissen |
| Abgesagt | fällt aus |
| Archiviert | nicht mehr öffentlich sichtbar |

Beginnt ein Turnier laut Termin, wechselt der Status automatisch auf *Läuft*.

### Ablauf eines Turniers

1. **Anlegen**: Titel, Spiel, Kurzbeschreibung.
2. **Ausschreiben**: Termine, Format, Regeln, Anmeldelink (z. B. Battlefy),
   Banner. Status auf *Angekündigt* oder *Anmeldung offen*, dann veröffentlichen.
3. **Während des Turniers**: Livestream-Link ergänzen, Teilnehmende erfassen.
4. **Danach**: Status auf *Abgeschlossen*, Ergebnisse eintragen (Platz 1 setzt
   automatisch den Gewinner), Rückblick und Galerie ergänzen.

Vergangene Turniere bleiben als Archiv erhalten – als Referenz für die
Community und für Sponsoringgespräche.

## Sponsoren und Partner

*Sponsoren*

- **Aktiv** oder **Ehemalig** unterscheidet aktuelle von früheren Partnern.
  Beide werden auf der Partnerseite getrennt dargestellt.
- **Stufe** (z. B. Hauptsponsor, Hosting-Partner) steuert die Sortierung.
- **Logo** aus der Medienbibliothek. Logos werden immer proportional
  eingepasst, nie verzerrt oder beschnitten.
- Die Zuordnung zu Turnieren erfolgt in der jeweiligen Turnierverwaltung.

Ein Partner erscheint erst nach **Veröffentlichen** auf der Website. Nicht
bestätigte Partnerschaften bitte nicht veröffentlichen.

## Social Media

*Social Media*

**Accounts** sind die Profile der Community. Ein Account erscheint auf der
Social-Seite und im Footer, sobald er aktiv ist. Followerzahlen sind optional
und werden von Hand gepflegt – ohne Eintrag wird nichts angezeigt.

**Beiträge** werden kuratiert erfasst: Titel, Adresse, optional Kurztext und
ein Vorschaubild aus der Medienbibliothek. Es werden bewusst keine Embeds der
Plattformen geladen: Die Seite bleibt schnell und überträgt keine Daten an
Dritte.

Die **Plattformfilter** auf der Social-Seite entstehen aus den vorhandenen
Beiträgen, nicht aus den Accounts: Ein Kanal ohne freigegebene Beiträge bekommt
keinen Filter. Gibt es nur eine Plattform mit Beiträgen oder gar keine, entfällt
die Filterzeile ganz.

Ein automatisches Veröffentlichen auf den Plattformen gibt es nicht. Dafür
wären die offiziellen APIs und Zugangsdaten der jeweiligen Anbieter nötig.

## Kontaktanfragen

*Kontakt → Anfragen*

Jede Anfrage erhält eine Referenznummer wie `SH-260412-A3F9C1`.

| Status | Bedeutung |
|---|---|
| Neu | noch nicht angesehen |
| In Bearbeitung | jemand kümmert sich darum |
| Beantwortet | Antwort wurde versendet |
| Geschlossen | erledigt |
| Spam | unerwünscht |

In der Detailansicht stehen der vollständige Verlauf, interne Notizen, die
Zuständigkeit und der Zustellstatus aller Nachrichten.

**Antworten** erfolgt direkt aus dem Dashboard. Die Antwort wird in die
Warteschlange gestellt und innerhalb einer Minute versendet.

**Datenschutz**: *Anonymisieren* entfernt Name, E-Mail und Nachrichtentext,
behält aber Status und Statistik. *Endgültig löschen* entfernt alles. Beides
wird im Audit-Log festgehalten. Zusätzlich anonymisiert die Anwendung Anfragen
automatisch nach der eingestellten Aufbewahrungsfrist.

## Medien

*Medien*

- Erlaubt sind JPEG, PNG, WebP, AVIF, GIF und PDF.
- Bilder werden beim Hochladen neu kodiert und optimiert; Metadaten wie
  Aufnahmeort werden dabei entfernt.
- **Alt-Text nicht vergessen.** Er beschreibt den Bildinhalt für Menschen, die
  einen Screenreader verwenden, und hilft zusätzlich der Auffindbarkeit. Die
  Medienbibliothek weist auf fehlende Alt-Texte hin.
- **Ersetzen** tauscht die Datei aus, ohne die Verwendungen zu brechen: Alle
  Stellen zeigen anschliessend die neue Datei.
- Vor dem Löschen zeigt die Bibliothek, wo eine Datei verwendet wird.

## Einstellungen

*Einstellungen* – zentrale Angaben, die auf der ganzen Website wirken.

Besonders zu beachten:

- **Discord-Einladungslink**: ohne ihn bleiben alle Discord-Schaltflächen
  verborgen.
- **Hauptlogo** (*Darstellung*): ein Bild aus der Medienbibliothek, das
  Kopfbereich, mobile Navigation, Fussbereich und die Startseite verwenden.
  Ohne Auswahl gilt die mitgelieferte Bildmarke. Empfohlen sind PNG oder WebP
  mit transparentem Hintergrund und mindestens 256 Pixel Kantenlänge; das
  Seitenverhältnis bleibt in jedem Fall erhalten.
- **Community-Zahlen**: Es erscheinen ausschliesslich Werte, die ausdrücklich
  als veröffentlicht markiert sind. Bitte nur geprüfte Zahlen freigeben.
  Angezeigt werden sie im Block *Statistiken* – der Einstieg der Startseite
  bleibt bewusst frei davon.
- **Wartungsmodus**: Besucher sehen die Wartungsseite, angemeldete
  Admin-Benutzer weiterhin die normale Website.
- **Aufbewahrungsfrist**: bestimmt, wann Kontaktanfragen automatisch
  anonymisiert werden.

## Benutzer und Rollen

*Benutzer & Rollen* (nur mit entsprechender Berechtigung)

Ein Konto entsteht bei der ersten Anmeldung über Discord und erhält zunächst
die Rolle **Nur Lesen**.

| Rolle | Zuständig für |
|---|---|
| Superadmin | alles, inklusive Benutzerverwaltung |
| Administrator | alle Inhalte, keine Benutzerverwaltung |
| Website-Redaktion | Seiten, Navigation, Medien |
| Turnierverwaltung | Turniere, Ergebnisse, zugehörige Medien |
| Sponsoring | Sponsoren und Stufen |
| Social Media | Accounts und Beiträge |
| Kontaktverwaltung | Anfragen und E-Mail-Empfänger |
| Nur Lesen | Einsicht ohne Änderungsrechte |

Rollen lassen sich kombinieren; die Rechte addieren sich. Einzelne
Berechtigungen jeder Rolle sind anpassbar. Änderungen wirken sofort.

**Deaktivieren** beendet alle laufenden Sitzungen des Kontos augenblicklich.

## Audit-Log

*Audit-Log* protokolliert alle administrativen Vorgänge: An- und Abmeldungen,
abgelehnte Zugriffe, Änderungen an Inhalten, Rollen- und Rechteänderungen,
Einstellungen sowie Lösch- und Anonymisierungsvorgänge.

Einträge lassen sich weder bearbeiten noch löschen – auch nicht von
Superadmins.
