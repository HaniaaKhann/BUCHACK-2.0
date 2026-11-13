FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/integrations/package.json packages/integrations/
COPY packages/simulator/package.json packages/simulator/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /repo/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @app/worker build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /repo/apps/worker/dist ./dist
COPY --from=builder --chown=app:app /repo/apps/worker/package.json ./package.json
COPY --from=builder --chown=app:app /repo/node_modules ./node_modules
USER app
CMD ["node", "dist/main.js"]
