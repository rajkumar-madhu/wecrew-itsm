# ═══════════════════════════════════════════════════════════
# LinkedEye ITSM — Backend Dockerfile
# ═══════════════════════════════════════════════════════════

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl openssh-client curl \
    && curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl && mv kubectl /usr/local/bin/

# Dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Build prisma
FROM deps AS prisma
COPY prisma ./prisma/
RUN npx prisma generate

# Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=prisma /app/node_modules ./node_modules
COPY --from=prisma /app/prisma ./prisma
COPY package*.json ./
COPY src ./src
# Operational scripts run inside the pod (seed-plans, trial-reminders cron).
COPY scripts ./scripts
COPY public ./public

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
