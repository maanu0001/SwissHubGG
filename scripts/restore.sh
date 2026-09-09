#!/usr/bin/env bash
#
# SwissHub – Wiederherstellung aus einer Sicherung.
#
# Aufruf:  ./scripts/restore.sh backups/swisshub-JJJJMMTT-HHMM
#
# Der Vorgang überschreibt die aktuelle Datenbank und die Medien. Er verlangt
# deshalb eine ausdrückliche Bestätigung und legt zuvor selbst eine Sicherung
# des aktuellen Stands an.

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-}"

# shellcheck source=scripts/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

trap 'fail "Die Wiederherstellung wurde in Zeile $LINENO abgebrochen."' ERR

[[ -n "$SOURCE" ]] || fail "Bitte das Verzeichnis der Sicherung angeben: ./scripts/restore.sh backups/swisshub-JJJJMMTT-HHMM"
[[ -d "$SOURCE" ]] || fail "Das Verzeichnis $SOURCE existiert nicht."
[[ -f "$SOURCE/datenbank.dump" ]] || fail "In $SOURCE fehlt die Datei datenbank.dump."

# Bereits gesetzte Umgebungsvariablen haben Vorrang vor der .env.
load_env "$ROOT_DIR/.env"

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL ist nicht gesetzt."

STORAGE_PATH="${STORAGE_DIR:-$ROOT_DIR/storage}"
COMPOSE_DB_SERVICE="${COMPOSE_DB_SERVICE:-db}"

# --- Prüfsummen kontrollieren ------------------------------------------------
if [[ -f "$SOURCE/pruefsummen.sha256" ]]; then
    log "Prüfsummen werden kontrolliert …"
    (cd "$SOURCE" && sha256sum --check --status pruefsummen.sha256) \
        || fail "Die Prüfsummen stimmen nicht – die Sicherung ist beschädigt."
fi

# --- Bestätigung -------------------------------------------------------------
cat <<WARN

  ACHTUNG
  Die aktuelle Datenbank und die aktuellen Medien werden vollständig
  durch den Stand aus $SOURCE ersetzt.

  Ziel-Datenbank: ${DATABASE_URL%%\?*}
  Medien:         $STORAGE_PATH

WARN

read -r -p "Zum Fortfahren 'WIEDERHERSTELLEN' eingeben: " CONFIRM
[[ "$CONFIRM" == "WIEDERHERSTELLEN" ]] || fail "Abgebrochen."

# --- Sicherheitsnetz ---------------------------------------------------------
log "Es wird zuerst eine Sicherung des aktuellen Stands erstellt …"
"$ROOT_DIR/scripts/backup.sh" "$ROOT_DIR/backups/vor-wiederherstellung" || \
    log "Hinweis: Der aktuelle Stand konnte nicht gesichert werden (evtl. leere Datenbank)."

# --- Anwendung anhalten ------------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker compose ps --quiet app >/dev/null 2>&1; then
    log "Anwendungscontainer wird angehalten …"
    docker compose stop app || true
    RESTART_APP=1
fi

# --- Datenbank ---------------------------------------------------------------
log "Datenbank wird wiederhergestellt …"

if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --clean --if-exists --no-owner --no-acl --dbname "$(libpq_url "$DATABASE_URL")" "$SOURCE/datenbank.dump"
elif command -v docker >/dev/null 2>&1; then
    docker compose exec -T "$COMPOSE_DB_SERVICE" \
        pg_restore --clean --if-exists --no-owner --no-acl \
        --username "${POSTGRES_USER:-swisshub}" --dbname "${POSTGRES_DB:-swisshub}" \
        < "$SOURCE/datenbank.dump"
else
    fail "Weder pg_restore noch Docker steht zur Verfügung."
fi

log "Datenbank wiederhergestellt."

# --- Medien ------------------------------------------------------------------
if [[ -f "$SOURCE/medien.tar.gz" ]]; then
    log "Medien werden wiederhergestellt …"
    mkdir -p "$STORAGE_PATH"
    # Der bisherige Stand wird beiseitegelegt, nicht gelöscht.
    if [[ -n "$(ls -A "$STORAGE_PATH" 2>/dev/null)" ]]; then
        MOVED="$STORAGE_PATH.vor-wiederherstellung-$(date +%Y%m%d-%H%M)"
        mv "$STORAGE_PATH" "$MOVED"
        mkdir -p "$STORAGE_PATH"
        log "Bisherige Medien liegen jetzt unter $MOVED"
    fi
    tar --extract --gzip --file "$SOURCE/medien.tar.gz" --directory "$STORAGE_PATH"
    log "Medien wiederhergestellt."
fi

# --- Migrationen und Neustart ------------------------------------------------
log "Ausstehende Migrationen werden angewendet …"
if command -v npx >/dev/null 2>&1; then
    (cd "$ROOT_DIR" && DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy)
else
    log "Hinweis: npx nicht verfügbar – bitte 'docker compose run --rm migrate' ausführen."
fi

if [[ "${RESTART_APP:-0}" == "1" ]]; then
    log "Anwendungscontainer wird gestartet …"
    docker compose start app
fi

log "Wiederherstellung abgeschlossen."
log "Bitte anschliessend prüfen: Startseite, Anmeldung im Dashboard und Medienanzeige."
