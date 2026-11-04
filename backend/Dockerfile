# Hi Day backend.
#
# Multi-stage: the build stage carries pnpm, the whole workspace and every
# devDependency; the runtime stage carries the compiled output and the
# production dependencies, and nothing else — no pnpm, no toolchain, no
# source.

# --- build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

# Manifests first, so a change to source code does not reinstall the world.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter backend...

COPY backend backend
RUN pnpm --filter backend build

# A self-contained tree with production dependencies only and no workspace
# symlinks, which is what makes the runtime stage copyable as plain files.
#
# `--legacy` is required from pnpm 10 on unless the workspace sets
# `inject-workspace-packages`; injection exists to rebuild local workspace
# packages into each consumer, and the backend depends on no workspace
# package, so there is nothing for it to do here.
RUN pnpm --filter backend deploy --prod --legacy /deploy

# --- runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production

# node:*-slim ships a `node` user (uid 1000). Nothing here needs root, and
# nothing here needs pnpm either — the entrypoint runs `node` directly.
WORKDIR /app
COPY --from=build --chown=node:node /deploy/node_modules ./node_modules
COPY --from=build --chown=node:node /deploy/package.json ./
COPY --from=build --chown=node:node /repo/backend/dist ./dist
COPY --chown=node:node backend/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

USER node
EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
