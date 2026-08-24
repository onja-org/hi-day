# Use plain pnpm workspaces with `frontend`/`backend`, not the Turborepo `apps/*` layout from TECH_DESIGN.md

`docs/TECH_DESIGN.md` §10 specifies a Turborepo monorepo (`apps/web`, `apps/api`, `apps/desktop`, `apps/extension`, `packages/shared`). The actual repo uses plain pnpm workspaces with two packages, `frontend` and `backend`. This is a deliberate simplification for the current build stage, not an oversight: the desktop agent, browser extension, and shared package don't exist yet, so the fuller layout would be premature structure with nothing to put in it.

`frontend`/`backend` is the settled structure going forward, not a placeholder. If/when the desktop agent or browser extension are added, revisit whether to migrate to the `apps/*` + Turborepo layout at that point — don't treat the current naming as temporary in the meantime.
