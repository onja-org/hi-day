@AGENTS.md

# Frontend Conventions

Rules for working in this Next.js frontend, in addition to whatever `AGENTS.md` (Next.js's own generated agent rules, imported above) says.

## Icons

- **Only use Remix Icon and Phosphor Icons — never install or suggest any other icon library.** Both are already dependencies (`remixicon`, `@phosphor-icons/react`); a third icon set fragments the visual style and bloats the bundle for no benefit.
- **Never use emoji as icons in the UI.** Emoji render inconsistently across platforms and fonts, and don't match the weight/style of the chosen icon sets.

## Tailwind

- **No arbitrary values (`w-[437px]`, `text-[13px]`) — extend the theme in `src/app/globals.css`'s `@theme` block if a custom value is needed.** (This project uses Tailwind v4, which is configured via CSS `@theme`, not a `tailwind.config.ts`.) Arbitrary values bypass the design system and produce one-off values that can't be reused or audited.
- **No inline `style` props — Tailwind classes only.** Inline styles can't be themed, responsive-prefixed, or picked up by Tailwind's tooling.
- **Always write responsive classes mobile-first (`sm:`, `md:`, `lg:`).** Unprefixed classes are the mobile baseline; prefixes layer on progressively larger breakpoints, matching Tailwind's own mobile-first design.
- **No hardcoded color hex values — use the theme palette only.** Hex values drift from the design system and make a future rebrand or dark-mode pass much harder.

## TypeScript

- **No `any` types — always type props, API responses, and function returns explicitly.** `any` defeats the type checker exactly where bugs are most likely: at data boundaries.
- **Define shared types in `src/types/` and reuse them — never re-declare inline.** Duplicate inline type declarations silently drift apart as the API or props evolve.

## Components

- **One component per file, named after the component.** Keeps imports predictable and components easy to locate.
- **Keep components under ~150 lines — split if they grow beyond that.** A component that outgrows this is usually mixing more than one concern.
- **Always handle loading and error states — never assume a fetch succeeds.** Networks fail; an unhandled failure means a silently broken UI for the user.
- **Use Next.js `<Image />` instead of `<img>` and `<Link />` instead of `<a>` for internal navigation.** These give automatic optimization (`Image`) and client-side transitions/prefetching (`Link`) that raw HTML tags don't.
- **Default to Server Components — only add `"use client"` when you actually need interactivity, browser APIs, or hooks.** Server Components ship less JS and keep data-fetching close to the source; `"use client"` should be a deliberate opt-in, not the default.
- **Never put sensitive logic or env vars in Client Components.** Anything in a Client Component ships to the browser and is visible to anyone inspecting the bundle.

## Testing

- **Only write Vitest tests for pure functions, utilities, and custom hooks that contain logic.** These are cheap to test and give the most signal per line of test code.
- **Never write render or snapshot tests for UI components.** Render/snapshot tests are brittle, tend to just re-assert markup, and rarely catch real regressions.
- **Each utility file handles exactly one concern and is named after that concern (e.g. `formatDate.ts`, `validateEmail.ts`) — never group unrelated functions into a generic `utils.ts` or `helpers.ts`.** One-concern files are easy to find, test, and reason about; grab-bag files become unmaintainable dumping grounds.
- **Every utility file must have a corresponding test file with the same name (`formatDate.test.ts`) living in the same folder.** Colocated, same-named tests make coverage gaps obvious at a glance.

## Code hygiene

- **No `console.log` left in committed code.** Leftover logs leak into production output and usually mean debugging code that never got cleaned up.
- **No commented-out code blocks.** Dead code in comments rots and confuses readers about what's actually active; git history is the place for old code.
- **Imports ordered: React → third-party → internal aliases → relative.** A consistent import order keeps diffs small and imports easy to scan.

## Folder structure

Do not deviate from this layout:

- `src/components/` — shared reusable components
- `src/app/` — pages and layouts only
- `src/hooks/` — custom React hooks
- `src/types/` — shared TypeScript types
- `src/lib/` — utilities and helpers, one concern per file
