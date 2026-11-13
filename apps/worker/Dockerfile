FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/integrations/package.json packages/integrations/
COPY packages/simulator/package.json packages/simulator/
RUN pnpm install --frozen-lockfile --filter @app/worker...

COPY packages/core packages/core
COPY packages/db packages/db
COPY apps/worker apps/worker
RUN pnpm --filter @app/db prisma:generate

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /repo /repo
USER node
WORKDIR /repo/apps/worker
CMD ["./node_modules/.bin/tsx", "src/main.ts"]
