# Workforce Monitoring — Web Console

The admin, reporting, and timesheet console for the Workforce Monitoring Platform.

Built with **Next.js** (App Router), **TypeScript**, and **Tailwind CSS**. Tests run on **Vitest** + React Testing Library.

---

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | Lint |
| `pnpm test` | Run tests once |
| `pnpm test:watch` | Run tests in watch mode |

## Project Structure

```
src/app/         — App Router pages and layouts
src/components/  — UI components
src/hooks/       — Custom hooks
src/lib/         — Utility functions, one concern per file (e.g. formatDate.ts)
src/types/       — Shared TypeScript types
public/          — Static assets
vitest.config.mts, vitest.setup.ts — Vitest configuration
```

## Testing conventions

- Tests live alongside the file they test, with the same name (`formatDate.ts` → `formatDate.test.ts`).
- Only pure functions, utilities, and custom hooks that contain logic get tests. UI components are not render-tested — if a component has logic worth testing, extract it into a hook or utility first.
- Utility files handle exactly one concern and are named after it — never a catch-all `utils.ts` or `helpers.ts`.
