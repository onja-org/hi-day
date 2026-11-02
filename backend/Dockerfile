# Hi Day backend.
#
# Multi-stage: the build stage carries pnpm, the whole workspace and every
# devDependency; the runtime stage carries the compiled output and the
# production dependencies, and nothing else.

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

# Strip the devDependencies rather than reinstalling: faster, and it cannot
# resolve a different tree from the one just built against.
RUN pnpm --filter backend prune --prod

# --- runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# node:*-slim ships a `node` user (uid 1000). Nothing here needs root.
WORKDIR /app
COPY --from=build --chown=node:node /repo/node_modules /app/node_modules
COPY --from=build --chown=node:node /repo/backend/node_modules /app/backend/node_modules
COPY --from=build --chown=node:node /repo/backend/dist /app/backend/dist
COPY --from=build --chown=node:node /repo/backend/package.json /app/backend/
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-workspace.yaml /app/

COPY --chown=node:node backend/docker-entrypoint.sh /app/backend/
RUN chmod +x /app/backend/docker-entrypoint.sh

USER node
WORKDIR /app/backend
EXPOSE 3001

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
