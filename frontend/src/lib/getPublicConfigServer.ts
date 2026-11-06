import { BACKEND_ORIGIN } from "./backendOrigin";
import {
  DEFAULT_PUBLIC_CONFIG,
  parsePublicConfig,
  type PublicConfig,
} from "./publicConfig";

/**
 * For Server Components, which render before any hook runs. Server-side
 * only — it reads `BACKEND_ORIGIN`, which does not exist in the browser.
 * Client Components want `useBillingEnabled`.
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
