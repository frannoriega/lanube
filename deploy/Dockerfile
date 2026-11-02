# Imagen de producción para el VPS (ver deploy/README.md). Dos destinos:
#   --target runner    -> la app (Next "standalone"), mínima, sin herramientas de build
#   --target migrator  -> prisma migrate deploy (lleva el CLI de Prisma; se corre antes de cada deploy)
#
# ⚠️ El build necesita una base de datos migrada: las páginas públicas se prerenderizan en el build
# (CLAUDE.md §19). CI levanta un Postgres descartable y lo pasa en DATABASE_URL; esa URL solo vive
# en la etapa `builder`, que nunca se publica. Nada de la base real entra a la imagen.

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# --- deps: `postinstall` corre `prisma generate`, que necesita el schema ---
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --no-audit --no-fund

# --- builder ---
FROM deps AS builder
ARG DATABASE_URL
# NEXT_PUBLIC_* se incrusta en el bundle en el build: no alcanza con ponerlo en el .env del servidor.
ARG NEXT_PUBLIC_TURNSTILE_SITEKEY
ENV DATABASE_URL=$DATABASE_URL \
  NEXT_PUBLIC_TURNSTILE_SITEKEY=$NEXT_PUBLIC_TURNSTILE_SITEKEY \
  NEXT_OUTPUT=standalone
COPY . .
RUN npx prisma migrate deploy && npx next build

# --- migrator: se usa solo con `docker compose run --rm migrate` ---
FROM builder AS migrator
ENV NODE_ENV=production
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# --- runner ---
FROM base AS runner
ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/.next/cache /data/uploads \
  && chown -R node:node /app /data
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/session').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
