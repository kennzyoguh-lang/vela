# Multi-stage build (Handbook 11.3) — build stage compiles TypeScript, runtime
# stage ships only compiled output + production dependencies (no dev deps, no
# source TS, smaller attack surface).
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY packages/config ./packages/config
COPY packages/design-tokens ./packages/design-tokens
COPY packages/types ./packages/types
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @vela/api...
RUN pnpm --filter @vela/api db:generate
RUN pnpm --filter @vela/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
EXPOSE 4000
CMD ["node", "dist/index.js"]
