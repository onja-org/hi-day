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

# Where this image's /api/backend/* proxy points.
#
# It has to be a build argument, not a runtime variable: Next.js evaluates
# `rewrites()` during `next build` and freezes the destination into
# routes-manifest.json, so a BACKEND_ORIGIN set only at container start is
# read too late and the proxy 500s. That is exactly what happened the first
# time this image was built.
#
# The default is the compose service name, which is right for every install
# that uses the docker-compose.yml in this repo. Deploying the two services
# somewhere else? Pass --build-arg BACKEND_ORIGIN=https://api.example.com.
ARG BACKEND_ORIGIN=http://backend:3001
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN

# Inlined into the browser bundle at build time, for the same reason. Both
# are public by design and both are optional — blank means the captcha
# challenge is never raised, and the in-app payment modal falls back to a
# link instead of drawing a card field.
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Nothing *billing*-related is baked in, though: the browser asks the
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
