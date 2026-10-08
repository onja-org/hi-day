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
- **The brand palette is closed — only these five colors, via their theme tokens, may be used anywhere in the UI.** They're the app's semantic names, mapped onto the Hi Day brand palette (see "Hi Day brand tokens" below):
  - `bg-primary` / `text-primary` / `border-primary` → Volt `rgb(61, 90, 254)` — primary actions, links, active states (white text on it passes contrast)
  - `bg-primary-dark` / `text-primary-dark` / `border-primary-dark` → Ink `rgb(18, 17, 23)` — headers, dark surfaces, primary text
  - `bg-secondary` / `text-secondary` / `border-secondary` → muted Ink `rgb(74, 72, 82)` — secondary accents
  - `bg-cream` / `text-cream` / `border-cream` → Sun tint `rgb(255, 240, 196)` — light surfaces, highlights, the active nav item
  - `bg-white` / `text-white` / `border-white` → `rgb(255, 255, 255)` — cards and panels; the page itself sits on Chalk (`rgb(248, 246, 241)`, the body background)
  - `text-slate-900` → general body/paragraph text, remapped to Ink (the one approved exception below)
  - Do not introduce any other color (no other Tailwind default-palette classes, and no new custom colors in `@theme`) without explicit user approval first. If a design calls for a shade Tailwind would normally offer (e.g. a hover or disabled state), derive it via opacity modifiers (`bg-primary/80`) rather than picking a new color. Don't write literal default-palette class names here even as counter-examples — see the note above about Tailwind's content scanner picking up literal text in this file.
  - **Exception:** `text-slate-900` is approved for general body/paragraph text where `text-primary-dark` would be too heavy (both now resolve to Ink; keep using whichever fits the intent). This is the only non-brand color class allowed — do not add others without approval.
  - **Two further approved exceptions:** `border-input-border` (a light gray — now the hairline for dividers, table rows and card outlines; form controls use `border-ink`, see the control recipes below) and `text-icon` (a dark slate, for utility icons like the password show/hide toggle). Don't add further one-off colors this way without explicit approval.
  - **A fifth approved exception, user-requested, scoped to Project colour tags only:** `bg-project-*` / `text-project-*` (blue, green, amber, red, purple, teal, pink, gray) — a fixed 8-colour swatch set for the Project entity's `colour` field (see `ProjectColourBadge`). A Project's colour is always one of this fixed set (validated server-side against the `ProjectColour` enum), never a free-form hex — don't wire a raw color picker to these tokens, and don't reuse them for anything other than a Project's own colour tag/swatch.
  - **A sixth approved exception:** `bg-success` / `text-success` (green) and `bg-error` / `text-error` (red) — semantic indicators for a positive/negative comparison or state (e.g. an up/down delta, a form error, a "worked time" chart bar). User-approved for `ThisWeekPanel`'s bar chart specifically; reuse for other positive/negative indicators is fine, but don't reach for `success`/`error` as a general-purpose second and third brand color.
- **Hi Day brand tokens — user-approved, usable app-wide:** the brand guide's palette as theme colours — `sun` (+ `sun-tint`), `ink` (+ `ink-raised`, `ink-muted`, `ink-soft`), `chalk`, `punch` (+ tint), `volt` (+ `volt-light`, tint), `mint` (+ tint), `bubble` (+ tint) — plus the `hard-sm`/`hard`/`hard-lg` offset shadows, `brand-sm`/`brand`/`brand-lg` radii, `display`/`heading`/`closing` text sizes, `heading` tracking, and the `display`/`brand`/`data` font families (Bricolage Grotesque, Figtree, JetBrains Mono — loaded by the root layout; `h1`/`h2` get the display face automatically, body copy is Figtree, and live timers/headline numbers use `font-data`). Prefer the semantic names above for everyday UI and reach for these for brand moments (the landing page, logos, celebratory accents). Follow the brand guide's pairing rule: ink text on every bright; chalk/white text only on volt and ink — never white text on sun, mint or punch. `success`/`error` stay a darker green/red rather than Mint/Punch, because the brights are too light for small text on white.
- **Brand control recipes — every button, field and floating panel follows these** (there's no shared Button component, so match them inline):
  - **Primary button:** `rounded-brand-sm border-2 border-ink bg-primary font-bold text-white hover:bg-primary/90`, `h-11 px-4`. Destructive: the same with `bg-error`.
  - **Secondary/outline button:** `rounded-brand-sm border-2 border-ink font-semibold text-slate-900 hover:bg-cream` (or `border-primary text-primary hover:bg-primary/10` for a volt outline next to a primary button).
  - **Text input, select, textarea, and field-like dropdown triggers:** `rounded-brand-sm border-2 border-ink bg-white` with `focus:border-primary focus:ring-2 focus:ring-primary/30` — normal font weight, so a selected value doesn't read as bold. Error state swaps the colour for `border-error`; when the colour is conditional, put it only in the `clsx` conditions (never `border-ink` in the base string too), since Tailwind resolves two border colours by CSS order, not class order. Prefer the `components/ui/form` fields, which already do this.
  - **Checkboxes and radios:** `accent-primary`.
  - **Floating panels (dropdowns, popovers, menus):** `rounded-brand-sm border-2 border-ink bg-white shadow-hard-sm`. Modals: `rounded-brand border-3 border-ink shadow-hard`.
  - Icon-only and ghost buttons stay borderless. No hard shadows on buttons — they get busy in toolbars and tables.
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
