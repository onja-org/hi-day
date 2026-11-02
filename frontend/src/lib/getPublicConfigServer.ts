import { BACKEND_ORIGIN } from "./backendOrigin";
import {
  DEFAULT_PUBLIC_CONFIG,
  parsePublicConfig,
  type PublicConfig,
} from "./publicConfig";

/**
 * The same question as `getPublicConfig`, asked from a Server Component.
 *
 * Server Components render before any hook runs, so a page that must 404
 * when billing is off cannot wait for the browser to find out — it has to
 * ask the backend directly, the way `isAuthenticated` does.
 *
 * `no-store` because the answer belongs to the deployment rather than the
 * request, and a cached "billing on" surviving a redeploy that turned it
 * off would show a paywall nobody can reach.
 *
 * Server-side only: it reads `BACKEND_ORIGIN`, which has no `NEXT_PUBLIC_`
 * prefix and so does not exist in the browser. Client Components want
 * `useBillingEnabled` instead.
 */
export async function getPublicConfigServer(): Promise<PublicConfig> {
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/config`, {
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_PUBLIC_CONFIG;
    return parsePublicConfig(await response.json());
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}
