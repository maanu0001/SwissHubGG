#!/usr/bin/env bash
#
# Gemeinsame Hilfsfunktionen der Betriebsskripte.
# Wird von backup.sh und restore.sh eingebunden.

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$1"; }
fail() { printf '[Fehler] %s\n' "$1" >&2; exit 1; }

# Liest eine .env-Datei ein, ohne bereits gesetzte Umgebungsvariablen zu
# überschreiben. So lässt sich ein Skript gezielt gegen eine andere Datenbank
# ausführen, ohne die .env anzupassen.
load_env() {
    local file="$1"
    [[ -f "$file" ]] || return 0

    local line key value
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"

        # Kommentare und Leerzeilen überspringen.
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^[[:space:]]*$ ]] && continue
        [[ "$line" != *"="* ]] && continue

        key="${line%%=*}"
        key="${key#export }"
        key="${key//[[:space:]]/}"
        [[ -z "$key" ]] && continue

        # Bereits gesetzte Werte haben Vorrang.
        [[ -n "${!key-}" ]] && continue

        value="${line#*=}"
        value="${value#"${value%%[![:space:]]*}"}"
        # Umschliessende Anführungszeichen entfernen.
        if [[ "$value" == \"*\" ]]; then
            value="${value:1:${#value}-2}"
        elif [[ "$value" == \'*\' ]]; then
            value="${value:1:${#value}-2}"
        fi

        export "$key=$value"
    done < "$file"
}

# Prisma hängt eigene Parameter an die Verbindungsadresse (z. B. `schema`,
# `connection_limit`), die libpq nicht kennt. Für pg_dump und pg_restore werden
# sie entfernt; alle libpq-tauglichen Parameter bleiben erhalten.
libpq_url() {
    local url="$1"
    local base="${url%%\?*}"
    local query=""

    if [[ "$url" == *"?"* ]]; then
        local raw="${url#*\?}"
        local IFS='&'
        local part
        for part in $raw; do
            case "${part%%=*}" in
                schema|connection_limit|pool_timeout|socket_timeout|pgbouncer|statement_cache_size|relationMode)
                    continue
                    ;;
            esac
            [[ -n "$part" ]] && query+="${query:+&}$part"
        done
    fi

    printf '%s%s' "$base" "${query:+?$query}"
}
