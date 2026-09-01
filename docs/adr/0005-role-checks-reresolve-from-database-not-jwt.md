---
status: accepted
---

# Role-gated routes/pages re-resolve the caller's Membership from the database on every request; the JWT never carries role

Added the first real role check in the codebase: `PATCH /organisations/:id` (editing Organisation settings) now requires `admin`, enforced by a `@RequireRole(...)` decorator + `RoleGuard` on the backend, and mirrored on the frontend by a `RequireRole` component that shows an inline "you don't have access" message (not a redirect) when an authenticated User's role doesn't qualify. This is the pattern any future role-gated route/page should follow, not a one-off.

## Considered options

Looked at how the sibling `hiring-matrix-backend`/`hiring-matrix-frontend` (Hirety) repos do this, since they have a mature, working RBAC system (per-capability `Role` flags like `can_view_dashboard`, `can_manage_users`, checked via a `PermissionGuard` + `usePageAccess` hook pair).

- **Embed role in the JWT** (Hirety's approach — their `login` issues a token with `role`/`role_id`/`tenant_id` baked in). Rejected: ADR-0002 already decided against this for the same reason Hirety's own `PermissionGuard` doesn't fully trust it either — it re-checks `permissionService.hasPermission(role_id, tenant_id, required)` against the database anyway on every guarded request. A Membership's role is mutable (an admin can demote someone at any time); embedding it in the token means a demotion doesn't take effect until the token is reissued. We keep the JWT identity-only and always re-resolve.
- **Client-side-only gating, page ships regardless** (Hirety's frontend pattern — `RequirePageAccess` wraps already-rendered page content and swaps to a "denied" state after a client fetch resolves). We took the *shape* of this (an inline denied message, not a redirect, matching Hirety's UX instinct that "authenticated but not allowed" is a different case from "not logged in") but not the mechanism — our denial is still backed by a real server-side 403 from `RoleGuard`, so the check isn't just cosmetic even though the frontend also renders it inline before attempting anything.

## Consequences

`RoleGuard` currently reads the target Organisation's id from the route's `:id` param — it only supports routes shaped like `/organisations/:id`. A future role-gated route with a different URL shape (or one scoped by something other than an explicit Organisation id) will need the guard extended, not just decorated. The frontend's `RequireRole` reuses the same `useCurrentOrganisation()` query the settings form already needed, so checking access never costs a second request beyond the one the page/modal would have made anyway.

The full permission matrix per role (`manager`, `member`, `finance`) is still undefined — only `admin`-vs-everyone-else exists as a real rule so far. `CONTEXT.md`'s `MembershipRole` entry tracks that as still open.
