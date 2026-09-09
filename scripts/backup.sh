#!/usr/bin/env bash
#
# SwissHub – Sicherung von Datenbank und Medien.
#
# Aufruf:   ./scripts/backup.sh [Zielverzeichnis]
# Standard: ./backups
#
# Erzeugt je Lauf ein Verzeichnis mit Zeitstempel:
#   backups/swisshub-JJJJMMTT-HHMM/
#     ├── datenbank.dump      (pg_dump, benutzerdefiniertes Format)
#     ├── medien.tar.gz       (Inhalt von STORAGE_DIR)
#     └── pruefsummen.sha256
#
# Sicherungen enthalten personenbezogene Daten. Sie gehören weder ins
# Git-Repository noch in ein öffentlich erreichbares Verzeichnis.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_ROOT="${1:-$ROOT_DIR/backups}"
STAMP="$(date +%Y%m%d-%H%M)"
TARGET="$TARGET_ROOT/swisshub-$STAMP"

# Anzahl aufzubewahrender Sicherungen (ältere werden entfernt).
RETENTION="${BACKUP_RETENTION:-14}"

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

trap 'fail "Die Sicherung wurde in Zeile $LINENO abgebrochen."' ERR

# Bereits gesetzte Umgebungsvariablen haben Vorrang vor der .env.
load_env "$ROOT_DIR/.env"

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL ist nicht gesetzt."

STORAGE_PATH="${STORAGE_DIR:-$ROOT_DIR/storage}"
COMPOSE_DB_SERVICE="${COMPOSE_DB_SERVICE:-db}"

mkdir -p "$TARGET"
log "Sicherung wird erstellt in $TARGET"

# --- Datenbank ---------------------------------------------------------------
log "Datenbank wird gesichert …"

if command -v pg_dump >/dev/null 2>&1; then
    pg_dump --format=custom --no-owner --no-acl --file="$TARGET/datenbank.dump" "$(libpq_url "$DATABASE_URL")"
elif command -v docker >/dev/null 2>&1 && docker compose ps --quiet "$COMPOSE_DB_SERVICE" >/dev/null 2>&1; then
    # Ohne lokales pg_dump wird der Datenbankcontainer verwendet.
    docker compose exec -T "$COMPOSE_DB_SERVICE" \
        pg_dump --format=custom --no-owner --no-acl \
        --username "${POSTGRES_USER:-swisshub}" "${POSTGRES_DB:-swisshub}" \
        > "$TARGET/datenbank.dump"
else
    fail "Weder pg_dump noch ein laufender Datenbankcontainer wurde gefunden."
fi

log "Datenbank gesichert ($(du -h "$TARGET/datenbank.dump" | cut -f1))"

# --- Medien ------------------------------------------------------------------
if [[ -d "$STORAGE_PATH" ]]; then
    log "Medien werden gesichert aus $STORAGE_PATH …"
    tar --create --gzip --file "$TARGET/medien.tar.gz" --directory "$STORAGE_PATH" .
    log "Medien gesichert ($(du -h "$TARGET/medien.tar.gz" | cut -f1))"
else
    log "Hinweis: $STORAGE_PATH existiert nicht – es werden keine Medien gesichert."
fi

# --- Prüfsummen --------------------------------------------------------------
(cd "$TARGET" && sha256sum ./* > pruefsummen.sha256)

# --- Überprüfung -------------------------------------------------------------
# Eine Sicherung ist erst dann eine Sicherung, wenn sie lesbar ist.
log "Sicherung wird überprüft …"

if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "$TARGET/datenbank.dump" > /dev/null \
        || fail "Die Datenbanksicherung ist nicht lesbar."
fi

if [[ -f "$TARGET/medien.tar.gz" ]]; then
    tar --test-label --file "$TARGET/medien.tar.gz" >/dev/null 2>&1 \
        || gzip --test "$TARGET/medien.tar.gz" \
        || fail "Die Mediensicherung ist beschädigt."
fi

(cd "$TARGET" && sha256sum --check --status pruefsummen.sha256) \
    || fail "Die Prüfsummen stimmen nicht überein."

log "Überprüfung erfolgreich."

# --- Aufbewahrung ------------------------------------------------------------
if [[ "$RETENTION" -gt 0 ]]; then
    mapfile -t OLD < <(find "$TARGET_ROOT" -maxdepth 1 -type d -name 'swisshub-*' | sort -r | tail -n "+$((RETENTION + 1))")
    for dir in "${OLD[@]:-}"; do
        [[ -n "$dir" ]] || continue
        log "Alte Sicherung wird entfernt: $(basename "$dir")"
        rm -rf "$dir"
    done
fi

chmod -R go-rwx "$TARGET"

log "Fertig: $TARGET"
log "Wichtig: Die Sicherung zusätzlich an einen anderen Ort übertragen (z. B. verschlüsselter Offsite-Speicher)."
