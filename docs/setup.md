# Lokale Einrichtung

Anleitung für die Entwicklung an der SwissHub-Website.

## Voraussetzungen

| Werkzeug | Version | Hinweis |
|---|---|---|
| Node.js | 22 oder neuer | `node --version` |
| npm | 10 oder neuer | liegt Node.js bei |
| PostgreSQL | 16 | lokal oder im Container |
| Git | aktuell | |

## Datenbank bereitstellen

**Variante A – PostgreSQL lokal installiert:**

```bash
sudo -u postgres psql -c "CREATE USER swisshub WITH PASSWORD 'entwicklung' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE swisshub OWNER swisshub;"
sudo -u postgres psql -c "CREATE DATABASE swisshub_test OWNER swisshub;"
```

**Variante B – nur den Datenbankcontainer starten:**

```bash
docker compose up -d db
```

## Projekt einrichten

```bash
npm ci

cp .env.example .env
```

In der `.env` mindestens setzen:

```dotenv
DATABASE_URL=postgresql://swisshub:entwicklung@localhost:5432/swisshub?schema=public
APP_URL=http://localhost:3000
SESSION_SECRET=<Ausgabe von: openssl rand -hex 32>
STORAGE_DIR=./storage
NODE_ENV=development
```

Datenbank vorbereiten und Grunddaten anlegen:

```bash
npx prisma migrate deploy
npm run db:seed
```

Der Seed ist idempotent: Er ergänzt nur, was fehlt, und überschreibt keine
bestehenden Inhalte.

## Entwicklungsserver

```bash
npm run dev
```

- Website: <http://localhost:3000>
- Dashboard: <http://localhost:3000/admin>

Für die Anmeldung wird eine Discord-Anwendung benötigt – siehe
[oauth.md](oauth.md). Ohne diese Konfiguration ist die öffentliche Website
vollständig nutzbar, das Dashboard jedoch nicht erreichbar.

## Tests

```bash
# Unit-Tests und Integrationstests
DATABASE_URL_TEST="postgresql://swisshub:entwicklung@localhost:5432/swisshub_test?schema=public" npm test
```

Die Integrationstests laufen gegen eine echte PostgreSQL-Datenbank und leeren
diese vor jedem Testfall. Ohne `DATABASE_URL_TEST` wird `DATABASE_URL`
verwendet – für die Entwicklungsdatenbank ist das nicht empfehlenswert.

## Gesamtprüfung vor einem Commit

```bash
npm run verify
```

Führt Typprüfung, Linting, Tests und den Produktions-Build nacheinander aus.

## Datenmodell ändern

```bash
# 1. prisma/schema.prisma anpassen
# 2. Migration erzeugen und anwenden
npm run prisma:migrate -- --name beschreibender_name

# 3. Prisma-Client neu erzeugen (passiert automatisch)
npm run prisma:generate
```

Migrationen werden versioniert und gehören ins Repository. Sie dürfen nach dem
Ausrollen nicht mehr verändert werden.

## Markenassets neu erzeugen

Das Original des Logos liegt unter `brand-source/swisshub-logo.jpg`. Daraus
werden alle Webvarianten abgeleitet:

```bash
npm run brand:icons
```

Erzeugt werden PNG- und WebP-Varianten in mehreren Auflösungen, App-Icons und
das Favicon. Das Logo wird dabei ausschliesslich skaliert und vom einfarbigen
Hintergrund befreit – es finden keine gestalterischen Änderungen statt.

## Häufige Stolpersteine

**„Environment variable not found: DATABASE_URL“**
Die `.env` fehlt oder wurde nicht geladen. Prisma-Befehle im Projektverzeichnis
ausführen.

**„SESSION_SECRET muss mindestens 32 Zeichen lang sein“**
Mit `openssl rand -hex 32` einen Wert erzeugen. Ein Wechsel meldet alle
angemeldeten Personen ab.

**Bilder werden nicht angezeigt**
`STORAGE_DIR` prüfen. Das Verzeichnis muss existieren und beschreibbar sein.
Hochgeladene Dateien liegen bewusst ausserhalb von `public/`.

**Änderungen im Builder erscheinen nicht auf der Website**
Der Builder speichert in den Entwurf. Erst *Veröffentlichen* überträgt den Stand
auf die öffentliche Website.
