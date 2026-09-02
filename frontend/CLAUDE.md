@AGENTS.md

# Frontend Conventions

Rules for working in this Next.js frontend, in addition to whatever `AGENTS.md` (Next.js's own generated agent rules, imported above) says.

## Icons

- **Only use Remix Icon and Phosphor Icons — never install or suggest any other icon library.** Both are already dependencies (`remixicon`, `@phosphor-icons/react`); a third icon set fragments the visual style and bloats the bundle for no benefit.
- **Never use emoji as icons in the UI.** Emoji render inconsistently across platforms and fonts, and don't match the weight/style of the chosen icon sets.

## Tailwind

- **No arbitrary bracketed values (a width or font-size hardcoded in square brackets) — extend the theme in `src/app/globals.css`'s `@theme` block if a custom value is needed.** (This project uses Tailwind v4, which is configured via CSS `@theme`, not a `tailwind.config.ts`.) Arbitrary values bypass the design system and produce one-off values that can't be reused or audited. Note: don't write literal bracketed examples in this doc even as counter-examples — Tailwind v4's content scanner reads all repo text for candidate class names, so a literal example here gets compiled into the CSS bundle even though nothing renders it.
- **No inline `style` props — Tailwind classes only.** Inline styles can't be themed, responsive-prefixed, or picked up by Tailwind's tooling.
- **Always write responsive classes mobile-first (`sm:`, `md:`, `lg:`).** Unprefixed classes are the mobile baseline; prefixes layer on progressively larger breakpoints, matching Tailwind's own mobile-first design.
- **No hardcoded color hex values — use the theme palette only.** Hex values drift from the design system and make a future rebrand or dark-mode pass much harder.
- **The brand palette is closed — only these five colors, via their theme tokens, may be used anywhere in the UI:**
  - `bg-primary` / `text-primary` / `border-primary` → `rgb(37, 156, 217)` — primary actions, links, active states
  - `bg-primary-dark` / `text-primary-dark` / `border-primary-dark` → `rgb(0, 54, 115)` — headers, dark surfaces, primary text
  - `bg-secondary` / `text-secondary` / `border-secondary` → `rgb(93, 84, 144)` — secondary accents
  - `bg-cream` / `text-cream` / `border-cream` → `rgb(255, 246, 214)` — light surfaces, highlights
  - `bg-white` / `text-white` / `border-white` → `rgb(255, 255, 255)` — base background
  - `text-slate-900` → general body/paragraph text (the one approved exception below)
  - Do not introduce any other color (no other Tailwind default-palette classes, and no new custom colors in `@theme`) without explicit user approval first. If a design calls for a shade Tailwind would normally offer (e.g. a hover or disabled state), derive it via opacity modifiers (`bg-primary/80`) rather than picking a new color. Don't write literal default-palette class names here even as counter-examples — see the note above about Tailwind's content scanner picking up literal text in this file.
  - **Exception:** `text-slate-900` is approved for general body/paragraph text where the brand navy (`text-primary-dark`) would be too heavy. This is the only non-brand color class allowed — do not add others without approval.
  - **Two further approved exceptions, both user-requested, scoped narrowly to form inputs:** `border-input-border` (a light gray, for the default/resting border of `<input>` elements — not buttons, cards, or dividers) and `text-icon` (a dark slate, for utility icons like the password show/hide toggle). Don't extend either token's usage beyond that scope, and don't add further one-off colors this way without the same kind of explicit approval.
- **Never store a `className` string in a module-level constant (e.g. `const INPUT_CLASSES = "..."`) — write the class string directly inline on the element, even if it repeats across several elements in the same file.** A constant makes classes cheaper to write once but harder to scan and edit per-element; inline keeps every element's full styling visible at its own call site.
- **When a `className` is conditional or merges a prop-provided class with a base class, use `clsx` (already a dependency) instead of a ternary or template literal.** Express each condition as its own `condition && "classes"` entry rather than `condition ? "a" : "b"` — additive `&&` entries extend cleanly when a third state/variant is added later; a ternary has to be restructured. Reach for `clsx` only when there's an actual condition or a prop-provided class to merge — a purely static, unconditional class string should just be a plain string, not wrapped in `clsx` for its own sake.

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

## Markup & Accessibility

- **Always reach for the semantic HTML tag first** (`<button>`, `<nav>`, `<header>`, `<footer>`, `<main>`, `<section>`, `<article>`, `<ul>`/`<ol>`, `<label>`, etc.) **— fall back to a generic `<div>`/`<span>` only when no semantic tag fits.** Semantic tags give free keyboard navigation, screen-reader landmarks, and browser default behavior that a `<div>` has to reimplement by hand.
- **Keep UI simple — favor the plainest structure and fewest moving parts that satisfy the requirement.** Don't reach for nested layout wrappers, extra visual layers, or custom interactive widgets when a simpler native element or a couple of plain elements already do the job. Complexity here is a UX and maintenance cost, not a sign of quality.
- **Support accessibility wherever it's needed for the content to be usable non-visually:**
  - Every `<img>` (or Next.js `<Image />`) needs a meaningful `alt` (empty `alt=""` only for purely decorative images).
  - Every form input needs an associated `<label>` (or `aria-label`/`aria-labelledby` when a visible label isn't appropriate).
  - Custom interactive elements (anything clickable that isn't a native `<button>`/`<a>`) need the correct `role`, keyboard handling (`Enter`/`Space`), and focus styling — but prefer the native element over building this yourself.
  - Use `aria-*` attributes only to fill a genuine gap semantic HTML can't cover — don't sprinkle them by default on elements that are already accessible by nature.

## Testing

- **Only write Vitest tests for pure functions, utilities, and custom hooks that contain logic.** These are cheap to test and give the most signal per line of test code.
- **Never write render or snapshot tests for UI components.** Render/snapshot tests are brittle, tend to just re-assert markup, and rarely catch real regressions.
- **Each utility file handles exactly one concern and is named after that concern (e.g. `formatDate.ts`, `validateEmail.ts`) — never group unrelated functions into a generic `utils.ts` or `helpers.ts`.** One-concern files are easy to find, test, and reason about; grab-bag files become unmaintainable dumping grounds.
- **Every utility file must have a corresponding test file with the same name (`formatDate.test.ts`) in `src/tests/` — unless the file has no logic to test.** Test files live in the shared `src/tests/` folder, not next to the source they test; import the module under test via the `@/lib/...` alias rather than a relative path. A file that's just a constant or a bare re-export (e.g. `apiUrl.ts`) doesn't need one: there's no branch or edge case a test could catch, so it'd just restate the one line of source. The moment a "no logic" file grows a conditional or a second responsibility, it needs its test added in that same change, not deferred.

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
- `src/tests/` — all Vitest test files, mirroring `src/lib/`'s filenames (see Testing above) — never colocated next to the source they test

## Auth-gated pages

- **Any page that should only render for a logged-in user goes under `src/app/(protected)/`** (e.g. `src/app/(protected)/dashboard/page.tsx`) — never add a per-page auth check by hand. The route group's `layout.tsx` calls `isAuthenticated()` (`src/lib/isAuthenticated.ts`) once and redirects to `/` if it fails; every page nested under it inherits that check automatically. A route group's parenthesized segment doesn't appear in the URL, so `(protected)/dashboard` still serves at `/dashboard`.
- This exists because a page (`/dashboard`) once shipped with no auth check at all — it rendered unconditionally regardless of session state, so logging out in one tab didn't stop another tab showing the same page on reload. A shared layout makes that class of bug structurally impossible to reintroduce, since forgetting to check auth on a new page is no longer a thing you can do — the layout does it for you.
