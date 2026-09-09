# Architektur

Technische Übersicht über Aufbau, Datenmodell, Sicherheit und Performance.

## Grundgedanke

Die öffentliche Website ist eine reine Leseanwendung: Sie liest einen
veröffentlichten Stand und stellt ihn dar. Das Admin-Dashboard schreibt diesen
Stand. Beides ist sauber getrennt – ein Fehler in der Redaktion kann die
Website nicht in einen ungültigen Zustand bringen.

```
Redaktion ──► Entwurf (PageSection) ──[Veröffentlichen]──► Snapshot (Page.publishedContent)
                                                                    │
                                                                    ▼
                                                     Öffentliche Website (nur Lesen)
```

Die Website liest **ausschliesslich** `publishedContent`. Ein Entwurf kann
deshalb prinzipiell nicht öffentlich sichtbar werden.

## Technische Grundlagen

| Baustein | Wahl | Begründung |
|---|---|---|
| Framework | Next.js 16, App Router | Server Components halten das ausgelieferte JavaScript klein |
| Sprache | TypeScript, Strict Mode | Fehler fallen beim Bauen auf, nicht im Betrieb |
| Datenbank | PostgreSQL 16 + Prisma | verlässliche Constraints, typisierte Abfragen, versionierte Migrationen |
| Gestaltung | Tailwind CSS 4 | Designsystem als Tokens, kein separates CSS-Framework |
| Validierung | Zod | dieselben Regeln im Browser und auf dem Server |
| Schrift | Inter, selbst gehostet | keine Anfrage an Drittanbieter |
| Icons | eigene Inline-SVG | spart ein zusätzliches Paket |
| Diagramme | eigenes SVG | keine Diagrammbibliothek im Bundle |

Bewusst **nicht** eingesetzt: UI-Bibliotheken, Drag-and-drop-Bibliotheken,
Icon-Pakete, Diagrammbibliotheken, externe Analysedienste.

## Verzeichnisse

```
src/
├── app/
│   ├── (site)/          Öffentliche Website
│   ├── admin/
│   │   ├── login/       Anmeldung (ohne Sitzung erreichbar)
│   │   └── (dashboard)/ Geschützte Oberfläche
│   ├── api/             Medien, Statistik, Healthcheck, OG-Bilder, Export
│   └── vorschau/        Vorschau nicht veröffentlichter Entwürfe
├── components/
│   ├── admin/           Dashboard und Website-Builder
│   ├── sections/        Renderer der Inhaltselemente
│   ├── site/            Bausteine der öffentlichen Website
│   └── ui/              Gemeinsame Elemente
├── lib/                 Fachlogik
└── server/actions/      Server Actions, jeweils mit Rechteprüfung
```

## Datenmodell

Zentrale Zusammenhänge:

```
AdminUser ──< UserRole >── Role ──< RolePermission >── Permission
    │
    └──< Session

Page ──< PageSection          (Entwurf)
     └──< PageVersion         (Archiv jeder Veröffentlichung)

Tournament ──< TournamentTeam
           ├──< TournamentResult
           ├──< TournamentMedia >── MediaAsset
           └──< TournamentSponsor >── Sponsor ──> SponsorTier

ContactRequest ──< ContactMessage >── EmailJob
               ├──< ContactNote
               ├──< ContactAttachment
               └──> ContactCategory ──< EmailRecipientCategory >── EmailRecipient

SocialAccount ──< SocialPost
Navigation ──< NavigationItem
```

Weitere Tabellen: `GlobalSetting`, `FeatureFlag`, `Redirect`, `AuditLog`,
`SiteMetric`, `RateLimitCounter`, `ConsentRecord`, `TeamMember`, `OAuthState`,
`EmailTemplate`, `MediaAsset`, `TournamentGame`.

### Entscheidungen im Datenmodell

**Snapshot statt Verweis.** `Page.publishedContent` enthält den vollständigen
veröffentlichten Stand als JSON. Ein Seitenaufruf braucht damit genau eine
Abfrage, und ein Entwurf kann nicht versehentlich sichtbar werden.

**Löschen mit Bedacht.** Referenzen, deren Verlust den Datensatz nicht
entwertet, werden auf `NULL` gesetzt (`onDelete: SetNull`) – etwa die Kategorie
einer Kontaktanfrage. Abhängige Datensätze, die ohne ihr Elternobjekt sinnlos
sind, werden mitgelöscht (`Cascade`) – etwa Teams eines Turniers.

**Archivieren statt löschen.** Inhalte mit historischem Wert (Seiten, Turniere,
Sponsoren) tragen ein `archivedAt`. Der Datensatz bleibt erhalten, die Website
zeigt ihn nicht mehr.

**Audit-Log ohne Fremdschlüsselzwang.** Wird ein Konto gelöscht, bleibt der
Protokolleintrag bestehen; nur die Zuordnung wird gelöst. Der Klarname steht
zusätzlich in `actorLabel`.

## Berechtigungen

24 einzeln vergebbare Berechtigungen, gruppiert in acht Standardrollen. Jede
geschützte Route und jede Server Action prüft die Berechtigung erneut:

```ts
export async function updateSponsorAction(state, formData) {
  const user = await requirePermissionForAction(PERMISSIONS.SPONSORS_MANAGE);
  // …
}
```

Die Oberfläche blendet gesperrte Bereiche zwar aus, ist aber niemals die
Schutzschicht. Rechte werden bei jedem Request frisch aus der Datenbank
gelesen – es gibt keinen Rechte-Cache über Requests hinweg. Entzogene Rechte
wirken damit sofort.

## Sicherheit

### Anmeldung

- Discord OAuth2 mit PKCE; `state` liegt zugleich im Cookie und (gehasht) in
  der Datenbank und ist einmalig verwendbar.
- Sitzungs-Token werden nie im Klartext gespeichert – in der Datenbank liegt
  nur ein HMAC. Ein Datenbankleck liefert damit keine übernehmbaren Sitzungen.
- Cookies: `HttpOnly`, `Secure` (bei HTTPS), `SameSite=Lax`.
- Sitzungen sind jederzeit widerrufbar; das Deaktivieren eines Kontos beendet
  alle laufenden Sitzungen.
- Fällt Discord aus, wird der Zugriff verweigert. Es gibt keinen Notfallzugang.

### Eingaben und Ausgaben

- Jede Eingabe wird serverseitig mit Zod geprüft.
- Rich Text entsteht aus Markdown und wird anschliessend gegen eine enge
  Positivliste gefiltert. Freies HTML oder JavaScript erreicht die Website nie.
- URLs aus dem CMS werden geprüft; erlaubt sind `http`, `https`, `mailto` und
  interne Pfade. `javascript:` und `data:` werden verworfen.
- SQL-Injection ist durch Prisma ausgeschlossen; die wenigen Rohabfragen
  verwenden ausschliesslich parametrisierte Vorlagen.

### Content-Security-Policy

Die Middleware setzt pro Request eine CSP mit zufälliger Nonce:

```
script-src 'self' 'nonce-<zufällig>' 'strict-dynamic' https://challenges.cloudflare.com
frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
frame-src   nur YouTube (nocookie), Twitch und Turnstile
```

Dazu kommen `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security` und die
Cross-Origin-Richtlinien.

### Uploads

- Der Dateityp wird an der tatsächlichen Signatur erkannt, nicht an Endung
  oder gemeldetem MIME-Typ.
- Bilder werden mit `sharp` neu kodiert. Dabei fallen Metadaten und eventuell
  eingebettete Nutzlasten weg. SVG ist bewusst nicht erlaubt.
- Dateinamen vergibt der Server zufällig; Pfadanteile aus dem Upload werden
  verworfen. Jeder Speicherschlüssel wird gegen Pfadmanipulation geprüft.
- Dateien liegen ausserhalb von `public/` und werden nur über eine
  kontrollierte Route mit `nosniff` und eigener CSP ausgeliefert.
- Anhänge aus dem Kontaktformular erfordern eine Leseberechtigung und werden
  als Download ausgeliefert, nie im Browser gerendert.

### Rate Limiting

Datenbankgestützt und dadurch neustartfest:

| Bereich | Grenze |
|---|---|
| Kontaktformular | 2 pro Minute, 5 pro Stunde |
| Anmeldung | 10 Starts / 15 Rückrufe je 15 Minuten |
| Medien-Upload | 60 pro Stunde |
| Statistik-Meldungen | 120 pro 10 Minuten |
| Testmails | 5 pro Stunde |

Nginx begrenzt zusätzlich auf Netzwerkebene.

### Weiteres

- Kontaktformular mit Honeypot, optionalem CAPTCHA (Cloudflare Turnstile) und
  serverseitiger Prüfung.
- IP-Adressen werden ausschliesslich pseudonymisiert gespeichert.
- Fehlermeldungen nach aussen sind verständlich, aber ohne interne Details.
- Interne Empfängeradressen erscheinen nie im Frontend.

## Performance

### Zwischenspeicher

Öffentliche Inhalte laufen über einen prozessinternen Cache mit
Tag-Invalidierung (`src/lib/cache.ts`). Ein Seitenaufruf löst im Normalfall
keine Datenbankabfrage aus. Beim Veröffentlichen werden gezielt die betroffenen
Tags geleert:

```ts
invalidateTags(CacheTag.pages, CacheTag.page(slug));
```

Es gibt kein Polling und keine wiederkehrenden Abfragen. Zusätzlich greift eine
TTL, sodass Inhalte auch bei mehreren Instanzen spätestens danach konsistent
sind.

### Wenig clientseitiges JavaScript

Die öffentliche Website liefert nur vier interaktive Komponenten aus: die
mobile Navigation, den aktiven Navigationszustand, das Kontaktformular und das
nachladbare Video. Alles Übrige sind Server Components. FAQ-Abschnitte nutzen
`<details>` und funktionieren ganz ohne JavaScript.

### Bilder und Schrift

- Medien werden über `next/image` in AVIF oder WebP und passenden Grössen
  ausgeliefert.
- Bilder unterhalb des sichtbaren Bereichs werden verzögert geladen.
- Die Schrift liegt lokal als variable WOFF2-Datei mit `font-display: swap`.

### Externe Inhalte

Videos von YouTube und Twitch werden erst nach ausdrücklichem Klick geladen –
bis dahin gibt es keine Verbindung zu diesen Anbietern. Social-Media-Beiträge
werden mit lokal gespeicherten Vorschaubildern dargestellt statt mit Embeds.

### Datenbank

Indizes auf allen Feldern, nach denen die Website filtert und sortiert
(Status, Veröffentlichungsdatum, Slug, Sortierreihenfolge). Listen sind
seitenweise abrufbar. Zusammengehörige Abfragen laufen parallel über
`Promise.all`.

## Hintergrundlauf

Ein Intervalljob pro Serverprozess, gestartet über `instrumentation.ts`:

| Aufgabe | Takt |
|---|---|
| Terminierte Veröffentlichungen | jede Minute |
| Turnierstatus fortschreiben | jede Minute |
| E-Mail-Warteschlange | jede Minute |
| Aufbewahrungsfristen, Aufräumen | alle sechs Stunden |

Überlappende Läufe sind ausgeschlossen; E-Mail-Aufträge werden exklusiv
beansprucht (`FOR UPDATE SKIP LOCKED`). Der Lauf ist über
`ENABLE_BACKGROUND_JOBS` abschaltbar und im Dashboard manuell auslösbar.

## SEO

- Metadaten je Seite im Dashboard pflegbar, mit Standardwerten aus den
  Einstellungen.
- Canonical-URLs, Open Graph und Twitter Cards für jede Seite.
- Social-Vorschaubilder werden serverseitig aus Logo, Markenfarben und Titel
  erzeugt (`/api/og`) und lange zwischengespeichert.
- Strukturierte Daten als JSON-LD: `Organization`, `WebSite`, `Event` für
  Turniere und `BreadcrumbList`.
- Sitemap und `robots.txt` aktualisieren sich automatisch und enthalten nur
  veröffentlichte, indexierbare Inhalte.
- Admin-, Vorschau- und Entwurfsseiten sind über `robots.txt`, `X-Robots-Tag`
  und Metadaten dreifach von der Indexierung ausgenommen.
- Beim Ändern eines Slugs entsteht automatisch eine 308-Weiterleitung.

## Statistik und Datenschutz

Gespeichert werden ausschliesslich Tagessummen pro Seite oder Klickziel –
ohne Cookies, ohne IP-Adressen, ohne externe Dienste. Eine Zuordnung zu
einzelnen Personen ist damit nicht möglich. Aus demselben Grund weist das
Dashboard bewusst keine „eindeutigen Besucher“ aus: Diese Zahl liesse sich
ohne Wiedererkennung nicht ehrlich ermitteln.

Kontaktanfragen werden nach einer einstellbaren Frist automatisch
anonymisiert. Anonymisieren und Löschen sind jederzeit auch manuell möglich
und werden protokolliert.

## Tests

| Bereich | Prüfung |
|---|---|
| Sanitisierung | Skripte, Event-Handler, `javascript:`-Links, iframes |
| Abschnittsschemata | Vollständigkeit, Standardwerte, Ablehnung ungültiger Werte |
| Formatierung | Schweizer Datums- und Zahlenformate, Sommer-/Winterzeit |
| Berechtigungen | Katalog, Rollenzuschnitt, Prüflogik |
| Validierung | Kontaktformular, Einstellungen, E-Mail-Adressen |
| Einbettungen | erlaubte Anbieter, Statistik-Schlüssel |
| Kontakt (Integration) | Speicherung, Empfängerrouting, Rate Limiting, Anonymisierung |
| Rechte (Integration) | Rollenauflösung, sofortige Wirkung, Sitzungen, Audit-Log |
| Veröffentlichung (Integration) | Entwurf bleibt privat, Snapshot, Versionen, Wiederherstellung |

Die Integrationstests laufen gegen eine echte PostgreSQL-Datenbank, damit auch
Constraints und Transaktionen tatsächlich geprüft werden.
