# Produktivbetrieb

Anleitung für den Betrieb auf einem eigenen Ubuntu-Server mit Docker Compose
hinter Nginx.

## Zielbild

```
Internet
   │  HTTPS (443)
   ▼
Nginx (Host)  ── TLS, Rate Limits, Kompression, statische Auslieferung
   │  HTTP an 127.0.0.1:3000
   ▼
app (Container)  ── Next.js, eigenständiger Server, unprivilegierter Benutzer
   │
   ├── db (Container)      PostgreSQL 16, nur im internen Netz
   └── media-data (Volume) hochgeladene Dateien
```

Die Anwendung ist von aussen nie direkt erreichbar. Die Datenbank hat keinen
veröffentlichten Port.

## Voraussetzungen

- Ubuntu 22.04 oder 24.04
- Docker Engine mit Compose-Plugin
- Nginx
- Certbot für Let's Encrypt
- DNS-Einträge für `swisshub.gg` und `www.swisshub.gg` auf den Server

## Erste Installation

### 1. Quellcode ablegen

```bash
sudo mkdir -p /opt/swisshub
sudo chown "$USER":"$USER" /opt/swisshub
git clone <repository-url> /opt/swisshub
cd /opt/swisshub
```

### 2. Konfiguration erstellen

```bash
cp .env.example .env
chmod 600 .env

# Geheimnisse erzeugen
openssl rand -hex 32   # → SESSION_SECRET
openssl rand -base64 24 # → POSTGRES_PASSWORD
```

In der `.env` mindestens setzen:

```dotenv
NODE_ENV=production
APP_URL=https://swisshub.gg
SESSION_SECRET=<32-Byte-Hex>
POSTGRES_PASSWORD=<starkes Passwort>
DISCORD_CLIENT_ID=…
DISCORD_CLIENT_SECRET=…
DISCORD_GUILD_ID=…
DISCORD_BOOTSTRAP_SUPERADMIN_IDS=<eigene Discord-ID>
```

`DATABASE_URL` wird im Compose-Betrieb automatisch aus den `POSTGRES_*`-Werten
zusammengesetzt und muss in der `.env` nicht gesetzt werden.

### 3. Anwendung starten

```bash
docker compose up -d --build
```

### 4. Datenbank einrichten

```bash
docker compose run --rm migrate
```

Dieser Befehl wendet die Migrationen an und legt die Grunddaten an (Rollen,
Berechtigungen, Menüs, Kontaktkategorien und die Pflichtseiten). Er ist
idempotent und kann gefahrlos wiederholt werden.

### 5. Nginx einrichten

```bash
sudo cp deploy/nginx/swisshub.gg.conf /etc/nginx/sites-available/swisshub.gg
sudo ln -s /etc/nginx/sites-available/swisshub.gg /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/certbot

# Zertifikat ausstellen
sudo certbot certonly --webroot -w /var/www/certbot -d swisshub.gg -d www.swisshub.gg

sudo nginx -t && sudo systemctl reload nginx
```

#### Alternative: Apache als Reverse Proxy

Eine vollständige, einsatzfertige Konfiguration liegt unter
`deploy/apache/swisshub.gg.conf` – inklusive der Weiterleitung der abgelösten
Domain (siehe [Domainwechsel](#domainwechsel)).

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo cp deploy/apache/swisshub.gg.conf /etc/apache2/sites-available/
sudo a2ensite swisshub.gg
sudo apachectl configtest && sudo systemctl reload apache2
```

Wichtig ist vor allem eines: Der Proxy muss den **öffentlichen Host
durchreichen**. Bei Apache ist `ProxyPreserveHost` standardmässig **aus** – die
Anwendung sieht dann ihre interne Adresse (`127.0.0.1:3000`), der Browser sendet
aber die öffentliche. Next.js nimmt eine Server Action nur an, wenn `Origin` und
Host zusammenpassen; ohne diese Zeile scheitert deshalb jedes Speichern im
Dashboard, ohne dass im Formular ein Fehler sichtbar würde.

Dazu passend in der `.env`:

```env
APP_URL=https://swisshub.gg
TRUST_PROXY=true
```

`APP_URL` ist die öffentliche Adresse – nie `127.0.0.1:3001` und nie
`0.0.0.0:3000`. Sie ist die **einzige** Quelle für Weiterleitungen, den
OAuth-Rückruf und Canonical-Adressen: Nach der Anmeldung über Discord wird das
Ziel daraus gebaut, nicht aus der Adresse, unter der die Anwendung die Anfrage
entgegengenommen hat. Hinter dem Proxy wäre das sonst die interne Adresse – bei
einer Bindung auf `0.0.0.0:3000` landete die Weiterleitung auf
`https://0.0.0.0:3000/admin`. Eine Bind-Adresse in `APP_URL` wird deshalb beim
Start abgelehnt. Ein Wechsel der Domain ist im Kern eine Änderung dieser
Variablen – siehe [Domainwechsel](#domainwechsel).

Aus `APP_URL` leitet die Anwendung ausserdem die erlaubte Herkunft für Server
Actions ab (`allowedOrigins` in `next.config.ts`). Wird die Website unter
mehreren Domains betrieben, kommen die weiteren über `ADDITIONAL_ORIGINS`
(kommagetrennt) dazu.

Kontrolle nach dem Einrichten: **Dashboard → System → Reverse Proxy**. Dort
stehen der tatsächlich ankommende Host und die erwartete Adresse nebeneinander;
bei einer Abweichung nennt der Hinweis die nötige Einstellung.

### 6. Betrieb prüfen

```bash
curl -sS https://swisshub.gg/api/health
docker compose ps
```

Anschliessend unter `https://swisshub.gg/admin` anmelden und die
Ersteinrichtung im Dashboard abschliessen (siehe [inhalte.md](inhalte.md)).

**Danach `DISCORD_BOOTSTRAP_SUPERADMIN_IDS` wieder leeren** und
`docker compose up -d app` ausführen.

## Aktualisierung

```bash
cd /opt/swisshub

# 1. Sicherung erstellen – immer zuerst
./scripts/backup.sh

# 2. Neuen Stand holen
git pull --ff-only

# 3. Neu bauen und starten
docker compose up -d --build

# 4. Migrationen anwenden
docker compose run --rm migrate

# 5. Prüfen
curl -sS https://swisshub.gg/api/health
docker compose logs --tail 50 app
```

Die Umstellung erfolgt beim Neustart des Containers und dauert wenige Sekunden.
Für einen Betrieb ohne Unterbrechung müsste ein zweiter Container mit
Umschaltung im Nginx betrieben werden – für die Grösse dieser Anwendung ist das
nicht vorgesehen.

## Rollback

Wenn ein Update Probleme macht:

```bash
# 1. Auf den vorherigen Stand zurück
git log --oneline -5
git checkout <vorheriger-commit>

# 2. Neu bauen und starten
docker compose up -d --build

# 3. Nur falls die Migration das Schema verändert hat:
#    Sicherung von vor dem Update zurückspielen
./scripts/restore.sh backups/swisshub-<zeitstempel>
```

**Wichtig:** Migrationen sind nicht automatisch umkehrbar. Wenn ein Update das
Schema verändert hat, ist die Sicherung der einzige verlässliche Weg zurück.
Deshalb gilt: vor jedem Update sichern.

## Domainwechsel

Die Anwendung erzeugt **jede** absolute Adresse aus `APP_URL`: Canonical-Links,
Open Graph, strukturierte Daten, Sitemap, `robots.txt`, den OAuth-Rückruf, die
Weiterleitung nach der Anmeldung und die Links in E-Mails. Der Wechsel ist
deshalb im Kern eine Änderung dieser einen Variablen – plus vier Schritten
darum herum.

**1. Sichern.**

```bash
cd /opt/swisshub && ./scripts/backup.sh
```

**2. `.env` anpassen.**

```env
APP_URL=https://swisshub.gg
```

Weiter zu prüfen: `ADDITIONAL_ORIGINS` (die abgelöste Domain gehört dort
**nicht** hinein – sie wird im Proxy weitergeleitet und erreicht die Anwendung
gar nicht) sowie `MAIL_FROM_ADDRESS` und `SMTP_USER`, falls das Postfach
mitwechselt.

**3. Container neu erstellen.** `APP_URL` wird beim Start gelesen; ein Neubau
des Images ist nicht nötig, solange sich der Code nicht geändert hat.

```bash
docker compose up -d app
```

**4. Gespeicherte Adressen umstellen.** Alte Adressen, die jemand von Hand in
Inhalte geschrieben hat – Links in Seitenabschnitten, E-Mail-Vorlagen,
Menüpunkten, Weiterleitungen, Einstellungen –, wandern nicht mit. Dafür gibt es
ein eigenes Skript. Es zeigt zuerst nur an, was es ändern würde:

```bash
# Vorschau – schreibt nichts
docker compose run --rm migrate npx tsx scripts/migrate-domain.ts --von new.swisshub.gg

# Nach Sichtung ausführen
docker compose run --rm migrate npx tsx scripts/migrate-domain.ts --von new.swisshub.gg --anwenden

# Zwischenspeicher neu füllen
docker compose up -d app
```

Ausgeführt wird das über den `migrate`-Dienst: Das Laufzeit-Image enthält
bewusst weder `tsx` noch die Skripte. Ohne Docker genügt `npm run
domain:migrate -- --von new.swisshub.gg`.

Das Ziel ist standardmässig `APP_URL`; mit `--nach https://…` lässt es sich
ausdrücklich angeben. Eine Bind- oder Loopback-Adresse als Ziel wird abgelehnt.
Ersetzt wird ausschliesslich der angegebene Host – andere Subdomains wie
`system.swisshub.gg`, fremde Adressen und E-Mail-Adressen bleiben unberührt,
Pfade, Suchparameter und Sprungmarken bleiben erhalten. Der Lauf ist
wiederholbar: Ein zweiter Durchgang findet nichts mehr. Bereits versandte
E-Mails und das Protokoll werden bewusst nicht angefasst.

**5. Discord anpassen.** Im Discord Developer Portal muss die Redirect-URI
exakt auf die neue Domain zeigen:

```
https://swisshub.gg/admin/login/callback
```

Die alte Adresse darf erst entfernt werden, wenn die neue eingetragen und
geprüft ist – sonst ist die Anmeldung zwischenzeitlich nicht möglich. Siehe
[oauth.md](oauth.md).

**6. Alte Domain weiterleiten.** Damit bestehende Links und die Bewertung in
Suchmaschinen erhalten bleiben, wird die abgelöste Domain dauerhaft (301) auf
die neue weitergeleitet – mit Pfad und Suchparametern. Bei Apache ist das in
`deploy/apache/swisshub.gg.conf` enthalten, bei Nginx aktiviert man
`deploy/nginx/new.swisshub.gg.conf`.

**Das Zertifikat der alten Domain wird weiterhin gebraucht.** Ohne gültiges
Zertifikat scheitert schon der Verbindungsaufbau, und die Weiterleitung kommt
nie zum Zug. Certbot muss `new.swisshub.gg` also weiter erneuern, solange alte
Links im Umlauf sind.

Prüfen:

```bash
curl -sI https://new.swisshub.gg/turniere?status=laufend | grep -i '^location'
# erwartet: location: https://swisshub.gg/turniere?status=laufend

curl -sS https://swisshub.gg/sitemap.xml | head -5
curl -sS https://swisshub.gg/robots.txt
```

## Wartungsmodus

Für geplante Arbeiten:

1. Im Dashboard unter *Einstellungen → Wartungsmodus* aktivieren.
2. Besucher sehen die Wartungsseite, angemeldete Admin-Benutzer die normale
   Website. `robots.txt` sperrt in diesem Zustand die Indexierung vollständig.
3. Nach den Arbeiten wieder deaktivieren.

## Betrieb und Überwachung

### Logs

```bash
docker compose logs -f app          # Anwendung
docker compose logs -f db           # Datenbank
sudo tail -f /var/log/nginx/swisshub.error.log
```

Die Logrotation ist in `docker-compose.yml` konfiguriert (5 Dateien à 10 MB).

### Healthchecks

Der Container prüft sich alle 30 Sekunden selbst über `/api/health`. Der
Endpunkt bestätigt, dass die Anwendung läuft und die Datenbank erreichbar ist.

```bash
docker compose ps        # Spalte STATUS zeigt (healthy)
```

Bei `unhealthy` startet Docker den Container nicht automatisch neu – die
Neustartregel ist `unless-stopped`, damit ein dauerhaft fehlerhafter Zustand
sichtbar bleibt und nicht in einer Neustartschleife endet.

### Hintergrundlauf

Ein Intervalljob im Anwendungscontainer erledigt jede Minute:

- terminierte Veröffentlichungen von Seiten, Turnieren, Sponsoren und Beiträgen
- den Versand der E-Mail-Warteschlange mit Wiederholungen
- alle sechs Stunden zusätzlich Aufbewahrungsfristen und Aufräumarbeiten

Der Lauf lässt sich im Dashboard unter *System* manuell auslösen. Bei mehreren
Anwendungsinstanzen darf `ENABLE_BACKGROUND_JOBS` nur auf einer aktiv sein.

### Automatische Sicherung

```bash
sudo crontab -e
```

```cron
# Täglich um 03:15 Uhr sichern
15 3 * * * cd /opt/swisshub && ./scripts/backup.sh >> /var/log/swisshub-backup.log 2>&1
```

Details siehe [backup.md](backup.md).

## Ressourcenbedarf

Für eine Community dieser Grösse genügt ein kleiner Server:

| | Empfehlung |
|---|---|
| CPU | 2 Kerne |
| Arbeitsspeicher | 2 GB (4 GB komfortabel) |
| Speicherplatz | 20 GB plus Platz für Medien und Sicherungen |

Öffentliche Inhalte werden im Anwendungsprozess zwischengespeichert; ein
Seitenaufruf löst im Normalfall keine Datenbankabfrage aus.

## Fehlersuche

**Container startet nicht**

```bash
docker compose logs app | tail -50
```

Häufigste Ursache: fehlendes oder zu kurzes `SESSION_SECRET`. Die Anwendung
bricht in diesem Fall bewusst mit einer klaren Meldung ab.

**502 Bad Gateway**

Die Anwendung läuft nicht oder lauscht nicht auf 3000.

```bash
docker compose ps
curl -sS http://127.0.0.1:3000/api/health
```

**Anmeldung schlägt fehl**

Redirect-URI im Discord Developer Portal muss exakt
`${APP_URL}/admin/login/callback` lauten. Siehe [oauth.md](oauth.md).

**Bilder fehlen nach einem Umzug**

Das Volume `media-data` wurde nicht mit übernommen. Medien aus der Sicherung
wiederherstellen – siehe [backup.md](backup.md).
