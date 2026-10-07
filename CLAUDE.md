# Hi Day

This is a pnpm workspace monorepo with three packages: `frontend` (Next.js), `backend` (NestJS), and `desktop` (Electron). `frontend` and `backend` each have their own conventions doc — read the one that matches what you're working on before making changes:

- **Frontend work** (anything under `frontend/`): read [`frontend/CLAUDE.md`](frontend/CLAUDE.md).
- **Backend work** (anything under `backend/`): read [`backend/CLAUDE.md`](backend/CLAUDE.md).
- **Desktop work** (anything under `desktop/`): read [`desktop/README.md`](desktop/README.md) — it has a full time-tracking timer (start/stop/pause/resume, idle detection, active-window tracking, screenshot capture) sharing the same backend `TimeEntriesService` as web, plus login/device-pairing.

See [`CONTEXT.md`](CONTEXT.md) for domain terms (Organisation, Membership, etc.) shared across packages.
See [`URL_TRACKING_CONTEXT`](URL_TRACKING_CONTEXT.md) for anything related to website/URL tracking.