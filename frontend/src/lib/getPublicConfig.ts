import { API_URL } from "./apiUrl";
import {
  DEFAULT_PUBLIC_CONFIG,
  parsePublicConfig,
  type PublicConfig,
} from "./publicConfig";

/**
 * Asks the backend what this installation is: Hi Day Cloud, or a
 * self-hosted install with no billing.
 *
 * Read at runtime rather than compiled in, so one built image serves both
 * shapes — a self-hoster runs the same container we do and flips an
 * environment variable on the *backend*, with no frontend rebuild.
 *
 * Never throws. An unreachable backend answers "billing off", which is the
 * safe guess — see `DEFAULT_PUBLIC_CONFIG`.
 */
export async function getPublicConfig(): Promise<PublicConfig> {
  try {
    const response = await fetch(`${API_URL}/config`, { method: "GET" });
    if (!response.ok) return DEFAULT_PUBLIC_CONFIG;
    return parsePublicConfig(await response.json());
  } catch {
    return DEFAULT_PUBLIC_CONFIG;
  }
}
