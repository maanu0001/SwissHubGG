# Sicherung und Wiederherstellung

Zu sichern sind zwei Dinge: die **PostgreSQL-Datenbank** (alle Inhalte,
Kontaktanfragen, Benutzerkonten, Audit-Log) und das **Medienverzeichnis**
(hochgeladene Bilder und Dokumente). Beides gehört zusammen – eine Datenbank
ohne die passenden Medien ergibt eine Website mit fehlenden Bildern.

## Sicherung erstellen

```bash
cd /opt/swisshub
./scripts/backup.sh
```

Das Skript legt ein Verzeichnis mit Zeitstempel an:

```
backups/swisshub-20260412-0315/
├── datenbank.dump      pg_dump im benutzerdefinierten Format
├── medien.tar.gz       Inhalt von STORAGE_DIR
└── pruefsummen.sha256  Prüfsummen beider Dateien
```

Nach dem Schreiben prüft das Skript selbst, ob der Dump lesbar ist, das Archiv
intakt ist und die Prüfsummen stimmen. Schlägt eine dieser Prüfungen fehl,
bricht der Lauf mit einem Fehler ab – eine unbrauchbare Sicherung wird nicht
stillschweigend als Erfolg gemeldet.

Ein anderes Zielverzeichnis lässt sich als Argument übergeben:

```bash
./scripts/backup.sh /mnt/backup/swisshub
```

## Automatische Sicherung

```bash
sudo crontab -e
```

```cron
15 3 * * * cd /opt/swisshub && ./scripts/backup.sh >> /var/log/swisshub-backup.log 2>&1
```

Standardmässig bleiben die letzten 14 Sicherungen erhalten; ältere werden
entfernt. Anpassbar über `BACKUP_RETENTION`:

```cron
15 3 * * * cd /opt/swisshub && BACKUP_RETENTION=30 ./scripts/backup.sh >> /var/log/swisshub-backup.log 2>&1
```

## Aufbewahrungsstrategie

Eine Sicherung auf demselben Server schützt vor Fehlbedienung, nicht vor
Hardwaredefekt, Diebstahl oder Verschlüsselungstrojanern. Empfohlen:

| Ebene | Aufbewahrung | Zweck |
|---|---|---|
| Täglich lokal | 14 Tage | schnelle Wiederherstellung nach Fehlbedienung |
| Wöchentlich extern | 8 Wochen | Schutz vor Serverausfall |
| Monatlich extern | 12 Monate | langfristige Nachvollziehbarkeit |

Beispiel für die Übertragung an einen anderen Ort:

```bash
# Verschlüsselt an einen zweiten Server übertragen
rsync -az --delete /opt/swisshub/backups/ backup@zweitserver:/srv/swisshub-backups/
```

Sicherungen enthalten personenbezogene Daten (Kontaktanfragen, Discord-Profile).
Sie gehören verschlüsselt aufbewahrt, nie in ein öffentlich erreichbares
Verzeichnis und niemals ins Git-Repository. Beides ist bereits abgesichert:
`.gitignore` schliesst `backups/` aus, das Skript setzt restriktive
Dateirechte.

## Sicherung prüfen

Eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung. Empfehlung:
**einmal pro Quartal** eine Wiederherstellung in einer Testumgebung.

```bash
# Testdatenbank anlegen
createdb swisshub_probe

# Sicherung dorthin zurückspielen
DATABASE_URL="postgresql://swisshub:passwort@localhost:5432/swisshub_probe" \
STORAGE_DIR=/tmp/swisshub-probe-medien \
  ./scripts/restore.sh backups/swisshub-20260412-0315

# Stichprobe
psql swisshub_probe -c 'SELECT count(*) FROM "Page";'
psql swisshub_probe -c 'SELECT count(*) FROM "ContactRequest";'
```

Bereits gesetzte Umgebungsvariablen haben Vorrang vor der `.env` – der
Probelauf berührt den Produktivbestand also nicht.

Eine schnelle Prüfung ohne Wiederherstellung:

```bash
pg_restore --list backups/swisshub-*/datenbank.dump | head
tar --list --file backups/swisshub-*/medien.tar.gz | head
sha256sum --check backups/swisshub-*/pruefsummen.sha256
```

## Wiederherstellung

```bash
cd /opt/swisshub
./scripts/restore.sh backups/swisshub-20260412-0315
```

Ablauf des Skripts:

1. Prüfsummen der Sicherung kontrollieren.
2. Ausdrückliche Bestätigung verlangen (`WIEDERHERSTELLEN` eintippen).
3. Den **aktuellen Stand zuerst sichern** – nach
   `backups/vor-wiederherstellung/`.
4. Anwendungscontainer anhalten.
5. Datenbank zurückspielen (`pg_restore --clean --if-exists`).
6. Medien zurückspielen; der bisherige Medienbestand wird umbenannt, nicht
   gelöscht.
7. Ausstehende Migrationen anwenden.
8. Anwendungscontainer wieder starten.

Nach der Wiederherstellung prüfen:

- Startseite lädt und zeigt die erwarteten Inhalte
- Anmeldung im Dashboard funktioniert
- Bilder werden angezeigt (Medien und Datenbank passen zusammen)
- `curl -sS https://swisshub.gg/api/health` meldet `ok`

## Sonderfälle

**Nur die Medien zurückholen**

```bash
tar --extract --gzip --file backups/swisshub-<stempel>/medien.tar.gz \
    --directory /pfad/zu/storage
```

**Nur einzelne Tabellen**

```bash
pg_restore --data-only --table=ContactRequest \
    --dbname "postgresql://…" backups/swisshub-<stempel>/datenbank.dump
```

**Umzug auf einen neuen Server**

1. Auf dem alten Server sichern: `./scripts/backup.sh`
2. Verzeichnis der Sicherung und die `.env` übertragen.
3. Auf dem neuen Server die Installation gemäss [deployment.md](deployment.md)
   durchführen, aber **ohne** `docker compose run --rm migrate`.
4. `./scripts/restore.sh <verzeichnis>` ausführen.
5. DNS umstellen und Zertifikat neu ausstellen.

## Was die Sicherung nicht enthält

| Nicht enthalten | Grund | Wiederherstellung |
|---|---|---|
| `.env` | enthält Geheimnisse; darf nicht in Sicherungen gelangen | getrennt und verschlüsselt aufbewahren |
| TLS-Zertifikate | werden von Certbot verwaltet | `certbot certonly …` neu ausstellen |
| Docker-Images | reproduzierbar aus dem Quellcode | `docker compose build` |

Die `.env` sollte getrennt gesichert werden, beispielsweise in einem
Passwortmanager des Vereins. Ohne `SESSION_SECRET` werden nach einer
Wiederherstellung alle angemeldeten Personen abgemeldet – die Daten bleiben
davon unberührt.
