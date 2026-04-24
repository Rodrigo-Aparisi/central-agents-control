FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS runner
RUN apk add --no-cache dumb-init
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/claude-runner/package.json ./packages/claude-runner/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/claude-runner ./packages/claude-runner

EXPOSE 8787
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import", "tsx/esm", "apps/api/src/server.ts"]
