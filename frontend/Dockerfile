# Hi Day web console.
#
# Multi-stage, ending in Next.js's standalone output: the server plus only
# the dependencies it imports, with no node_modules tree to ship.

# --- build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

COPY frontend frontend

# Nothing billing-related is baked in at build time: the browser asks the
# backend at runtime (GET /config), so this one image serves a self-hosted
# install and Hi Day Cloud alike.
RUN pnpm --filter frontend build

# --- runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# The standalone bundle, then the two directories it deliberately excludes.
COPY --from=build --chown=node:node /repo/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /repo/frontend/public ./frontend/public

USER node
EXPOSE 3000

# Where the standalone server lands for a package inside a pnpm workspace.
CMD ["node", "frontend/server.js"]
