# syntax=docker/dockerfile:1
#
# Team Tour bot — portable container image, same pattern as apps/tour/Dockerfile.
#
# IMPORTANT: build CONTEXT must be the REPO ROOT — the app is an npm-workspace member,
# so the install runs at the root. From the repo root:
#   docker build -f apps/tour-bot/Dockerfile -t team-tour-bot .
# (On Railway: Root Directory `/`, railway.json points dockerfilePath here.)

FROM node:24-bookworm-slim AS base
WORKDIR /app

# ── build: full workspace install at root → tsc ──
FROM base AS build
# Cache the install: copy only manifests (+ the prisma schema the root
# `postinstall: prisma generate` needs) so an app-source edit doesn't bust `npm ci`.
COPY package.json package-lock.json ./
COPY packages/competition-core/package.json ./packages/competition-core/
COPY packages/match-core/package.json ./packages/match-core/
COPY packages/tour-core/package.json ./packages/tour-core/
COPY apps/tour/package.json ./apps/tour/
COPY apps/tour-bot/package.json ./apps/tour-bot/
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build -w @balatro/tour-bot

# ── runtime ──
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/tour-bot
# Healthcheck server binds $PORT (default 8080) — the bot itself is a Discord gateway client.
EXPOSE 8080
CMD ["node", "dist/index.js"]
