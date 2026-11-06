const PRODUCTION_API_URL = 'https://api.hiday.io';
const DEV_API_URL = 'http://localhost:3001';

export function defaultApiBaseUrl(isPackaged: boolean): string {
  return isPackaged ? PRODUCTION_API_URL : DEV_API_URL;
}

/**
 * `DESKTOP_API_URL`, then the server typed on the login screen, then the
 * built-in default. A packaged app must never fall back to localhost — it
 * has no shell environment to inherit.
 */
export function resolveApiBaseUrl(
  isPackaged: boolean,
  remembered: string | null = null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.DESKTOP_API_URL) return env.DESKTOP_API_URL;
  if (remembered) return remembered;
  return defaultApiBaseUrl(isPackaged);
}

export type ServerUrlProblem = string | null;

const PLAIN_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isPrivateHost(hostname: string): boolean {
  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
    return true;
  }
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}

/**
 * Strict about the scheme only: a device token travels on every request, so
 * plain HTTP is allowed solely where traffic stays on the machine or the
 * local network — a self-hosted server on an office LAN rarely has a
 * certificate. A wrong host shows up on its own as "can't reach that
 * server".
 */
export function validateServerUrl(value: string): ServerUrlProblem {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter the address of your Hi Day server.';

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'That is not a valid address. It should look like https://hiday.example.com.';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'The address must start with https:// or http://.';
  }

  if (url.protocol === 'http:') {
    const host = url.hostname.toLowerCase();
    if (!PLAIN_HTTP_HOSTS.has(host) && !isPrivateHost(host)) {
      return 'Use https:// for a server on the internet. Plain http:// is only allowed for localhost and private networks.';
    }
  }

  return null;
}

/** Every request is built as `${base}/path`, so a stored trailing slash
 * would double up. */
export function normaliseServerUrl(value: string): string {
  const url = new URL(value.trim());
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}
