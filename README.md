# SwissHub – Website und Admin-Dashboard

Öffentliche Website und Content-Management-System der Schweizer Gaming-Community
**SwissHub**.

> «Zäme hock, zäme zocke»

---

## Überblick

| | |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript im Strict Mode |
| **Datenbank** | PostgreSQL 16 mit Prisma ORM |
| **Gestaltung** | Tailwind CSS 4, eigenes SwissHub-Designsystem, selbst gehostete Schrift |
| **Anmeldung** | Discord OAuth2 (PKCE) mit serverseitigen Sitzungen |
| **Betrieb** | Docker Compose hinter Nginx, Ubuntu-Server |
| **Sprache** | Deutsch, Schweizer Rechtschreibung, `de-CH`, `Europe/Zurich` |

Die öffentliche Website wird vollständig über einen blockbasierten
Website-Builder gepflegt. Turniere, Sponsoren, Social-Media-Inhalte,
Kontaktanfragen und globale Einstellungen werden im Admin-Dashboard verwaltet.

---

## Inhaltsverzeichnis

- [Schnellstart (Entwicklung)](#schnellstart-entwicklung)
- [Projektstruktur](#projektstruktur)
- [Ersteinrichtung](#ersteinrichtung)
- [Befehle](#befehle)
- [Weiterführende Dokumentation](#weiterführende-dokumentation)

---

## Schnellstart (Entwicklung)

Voraussetzungen: Node.js 22 oder neuer, PostgreSQL 16, Git.

```bash
# 1. Abhängigkeiten installieren
npm ci

# 2. Konfiguration anlegen
cp .env.example .env
# SESSION_SECRET erzeugen und in .env eintragen:
openssl rand -hex 32

# 3. Datenbank vorbereiten
npx prisma migrate deploy
npm run db:seed

# 4. Entwicklungsserver starten
npm run dev
```

Die Website läuft anschliessend unter <http://localhost:3000>, das Dashboard
unter <http://localhost:3000/admin>.

Für die Anmeldung am Dashboard wird eine Discord-Anwendung benötigt – siehe
[docs/oauth.md](docs/oauth.md).

---

## Projektstruktur

```
├── prisma/
│   ├── schema.prisma          Datenmodell
│   ├── migrations/            Versionierte Migrationen
│   └── seed.ts                Rollen, Menüs, Kategorien, Pflichtseiten
├── src/
│   ├── app/
│   │   ├── (site)/            Öffentliche Website
│   │   ├── admin/             Admin-Dashboard (Routen-Gruppe `(dashboard)`)
│   │   ├── api/               Medien, Statistik, Healthcheck, OG-Bilder
│   │   └── vorschau/          Vorschau nicht veröffentlichter Entwürfe
│   ├── components/
│   │   ├── admin/             Dashboard-Oberfläche und Website-Builder
│   │   ├── sections/          Renderer der 17 Inhaltselemente
│   │   ├── site/              Bausteine der öffentlichen Website
│   │   └── ui/                Gemeinsame Elemente
│   ├── lib/                   Fachlogik (Auth, Cache, Medien, E-Mail, SEO …)
│   ├── server/actions/        Server Actions mit Berechtigungsprüfung
│   └── middleware.ts          CSP mit Nonce und Admin-Vorprüfung
├── deploy/nginx/              Reverse-Proxy-Konfiguration
├── scripts/                   Sicherung, Wiederherstellung, Markenassets
├── tests/                     Unit- und Integrationstests
└── docs/                      Betriebs- und Einrichtungsdokumentation
```

---

## Ersteinrichtung

Nach der Installation sind einige Angaben nötig, die bewusst **nicht**
vorbelegt sind, weil sie nur die Community selbst gesichert kennt:

1. **Discord-Anmeldung einrichten** – siehe [docs/oauth.md](docs/oauth.md).
   Ohne diese Konfiguration ist kein Zugang zum Dashboard möglich.
2. **Als Superadmin anmelden**: eigene Discord-Benutzer-ID in
   `DISCORD_BOOTSTRAP_SUPERADMIN_IDS` eintragen, anmelden, anschliessend den
   Wert wieder leeren.
3. **Im Dashboard ergänzen** (siehe [docs/inhalte.md](docs/inhalte.md)):
   - Discord-Einladungslink (sonst bleiben alle Discord-Schaltflächen verborgen)
   - Adresse und Vertretung des Vereins für das Impressum
   - Community-Zahlen (werden erst nach ausdrücklicher Freigabe angezeigt)
   - Social-Media-Accounts, Sponsoren und Turniere
4. **E-Mail-Versand konfigurieren** – siehe [docs/email.md](docs/email.md).
   Ohne SMTP werden Nachrichten gespeichert, aber nicht versendet.

Das Dashboard weist auf der Startseite aktiv auf alle noch fehlenden Angaben
hin.

---

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm start` | Produktionsserver (nach `build`) |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm run lint` | ESLint |
| `npm test` | Unit- und Integrationstests |
| `npm run verify` | Typen, Lint, Tests und Build in einem Durchlauf |
| `npm run db:deploy` | Migrationen anwenden (Produktion) |
| `npm run prisma:migrate` | Neue Migration erzeugen (Entwicklung) |
| `npm run db:seed` | Grunddaten anlegen (idempotent) |
| `npm run brand:icons` | Logo-Varianten und Favicons neu erzeugen |
| `./scripts/backup.sh` | Datenbank und Medien sichern |
| `./scripts/restore.sh <Verzeichnis>` | Sicherung zurückspielen |

Für die Integrationstests wird eine eigene Datenbank empfohlen:

```bash
createdb swisshub_test
DATABASE_URL_TEST="postgresql://swisshub:passwort@localhost:5432/swisshub_test?schema=public" npm test
```

---

## Weiterführende Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/setup.md](docs/setup.md) | Lokale Einrichtung und Entwicklung im Detail |
| [docs/deployment.md](docs/deployment.md) | Produktivbetrieb, Updates, Rollback |
| [docs/oauth.md](docs/oauth.md) | Discord-Anwendung und Zugriffsrechte |
| [docs/email.md](docs/email.md) | SMTP, Empfänger, Vorlagen, Zustellstatus |
| [docs/backup.md](docs/backup.md) | Sicherung, Wiederherstellung, Aufbewahrung |
| [docs/inhalte.md](docs/inhalte.md) | Anleitung für Redaktion und Administration |
| [docs/architektur.md](docs/architektur.md) | Aufbau, Datenmodell, Sicherheit, Performance |

---

## Lizenz und Rechte

Der Quellcode dieses Projekts gehört SwissHub. Das SwissHub-Logo und die
Wortmarke sind geschützt und dürfen nicht ohne Zustimmung verwendet werden.

Die verwendete Schrift **Inter** steht unter der SIL Open Font License 1.1;
die Lizenz liegt unter `public/fonts/Inter-LICENSE.txt` bei.
