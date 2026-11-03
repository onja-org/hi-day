import { API_URL } from "./apiUrl";
import {
  DEFAULT_PUBLIC_CONFIG,
  parsePublicConfig,
  type PublicConfig,
} from "./publicConfig";

/**
 * Asked at runtime rather than compiled in, so one built image serves both a
 * self-hosted install and Hi Day Cloud. Never throws — an unreachable
 * backend answers "billing off".
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
