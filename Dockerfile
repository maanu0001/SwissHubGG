
##############################################################################
# SwissHub – Produktions-Image
#
# Mehrstufiger Build:
#   1. deps    – Abhängigkeiten reproduzierbar aus package-lock.json
#   2. builder – Prisma-Client erzeugen und Next.js bauen
#   3. runner  – schlankes Laufzeit-Image mit eigenständigem Server
#
# Der Container läuft als unprivilegierter Benutzer und enthält weder
# Entwicklungswerkzeuge noch Quellcode, der zur Laufzeit nicht gebraucht wird.
##############################################################################

ARG NODE_VERSION=22.20.0

# --- 1. Abhängigkeiten -------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

# openssl wird von den Prisma-Engines benötigt.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- 2. Build ----------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Der Build braucht keine Datenbankverbindung: Einstellungen fallen bei
# fehlender Verbindung auf ihre Standardwerte zurück.
RUN npx prisma generate && npm run build

# --- 3. Laufzeit -------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Europe/Zurich
ENV STORAGE_DIR=/data/storage

RUN groupadd --system --gid 1001 swisshub \
    && useradd --system --uid 1001 --gid swisshub swisshub

# Eigenständiger Server inklusive der nötigen node_modules.
COPY --from=builder --chown=swisshub:swisshub /app/.next/standalone ./
COPY --from=builder --chown=swisshub:swisshub /app/.next/static ./.next/static
COPY --from=builder --chown=swisshub:swisshub /app/public ./public

# Der eigenständige Server bringt die Prisma-Engine bereits mit. Prisma-CLI,
# tsx und die Migrationen gehören bewusst NICHT ins Laufzeit-Image: Sie werden
# über den `migrate`-Dienst aus der Build-Stufe ausgeführt (siehe
# docker-compose.yml). Das hält das Laufzeit-Image klein und ohne Werkzeuge,
# die im Betrieb nichts zu suchen haben.

# Verzeichnis für hochgeladene Medien – wird per Volume eingebunden.
RUN mkdir -p /data/storage && chown -R swisshub:swisshub /data

USER swisshub
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini sorgt für sauberes Signal-Handling und verhindert Zombie-Prozesse.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
