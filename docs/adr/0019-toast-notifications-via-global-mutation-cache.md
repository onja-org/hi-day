---
status: accepted
---

# Toast notifications fire from one global react-query `mutationCache` handler, not per call site

The frontend had no toast mechanism at all — failures rendered via a static inline `<ErrorMessage>` component, and successes (including cases where the backend already returned a `message`, e.g. `forgotPassword`) were silently discarded. With every mutation endpoint now returning `{ ..., message }` (docs/adr/0018), a `sonner` `<Toaster />` is mounted once in the root layout, and a single handler on the app's `QueryClient` (`mutationCache.onSuccess`/`onError` in `QueryProvider.tsx`) reads `.message` off every mutation's result and toasts it — success or error styling based on the result's `ok` flag. No component calls `toast()` directly.

Toasting only mutations (not queries) is meant to reserve toasts for feedback on an action the user took. Checked before implementing: no web mutation currently fires without an explicit user action (no `.mutate()` call sits inside a `useEffect`/`setInterval`/mount-triggered auto-save or reconcile anywhere in `frontend/src/components`) — every `.mutate()` call site is inside a submit/click handler. If a future mutation is added on a timer or effect, it will toast automatically too; that's a case to watch for, not something this design prevents structurally.

`sonner` was added as a new dependency (styled via `unstyled` + `classNames` against the existing `bg-success`/`text-success`/`bg-error`/`text-error` Tailwind tokens, never inline styles) rather than hand-rolling a toast component — stacking, auto-dismiss timing, exit animation, and accessibility are easy to get subtly wrong, and this is a small, dependency-light library rather than a UI kit.

## Considered options

- **Manual `toast()` call at each of the 48 mutation call sites** — rejected: a global handler gets every current and future `useMutation` call covered for free, without the risk of a call site being missed.
- **Refactoring the 48 `lib/*.ts` functions to throw on API failure**, so react-query's real `onError` fires — rejected. These functions already resolve to a discriminated union (`{ ok: true, ... } | { ok: false, message }`) that components check via `mutation.data.ok`, not `mutation.isError`. The global handler instead branches on `data.ok` from inside `onSuccess`; `onError` is only a fallback for genuinely thrown/unexpected exceptions (network failure, etc.), shown with a generic message. This avoided rewriting the existing success/failure convention across every component that already depends on it.
- **One shared `ApiResult<TSuccess, TFailure>` generic** (`frontend/src/types/api.ts`, `({ ok: true; message: string } & TSuccess) | ({ ok: false; message: string } & TFailure)`) replacing the 48 independently-duplicated per-feature `*Result` unions — chosen so the compiler guarantees `.message` is always present on any mutation result the global handler reads, instead of trusting 48 separate hand-written types to have remembered it. A handful of pre-existing types carry extra fields on their failure branch beyond `message` (`LoginResult.captchaRequired`, `AcceptInvitationResult.accountExists`, `TimeEntryActionResult.runningEntry`) — the second, defaulted type parameter preserves those instead of forcing a lossy conversion.
- **Scope of removing the inline `<ErrorMessage>` component**: toast replaces it only where it was fed by a `useMutation` result (form submit failures, etc.). Usages fed by a `useQuery`/data-load failure (a table or list failing to load) keep the inline component — that's a persistent page state, not a transient event, and a toast that disappears in a few seconds is the wrong tool for "this list is currently broken." The same rule applies symmetrically to `<SuccessMessage>` (the success-side mirror of `<ErrorMessage>`, discovered mid-implementation in ~10 components): removed wherever fed by a `useMutation` result (it would otherwise show the same message twice — once inline, once as a toast), left alone wherever it reflects a static/non-mutation page state.

## Consequences

The global handler does a defensive runtime check for `.message` before toasting, and additionally logs a dev-only console warning (never shown in production) when a mutation result doesn't have one — since by design every frontend mutation should conform to `ApiResult<T>` once migrated, a result that doesn't is treated as a genuine coverage gap to fix, not noise to suppress.

`string[]` validation-error arrays (from Nest's default exception body) are joined into a single toastable string entirely on the frontend, in one shared parser — see docs/adr/0020 for why this must never be done on the backend side.
