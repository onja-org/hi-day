const PRODUCTION_API_URL = 'https://api.hiday.io';
const DEV_API_URL = 'http://localhost:3001';

/** What the login screen offers before anybody types anything. */
export function defaultApiBaseUrl(isPackaged: boolean): string {
  return isPackaged ? PRODUCTION_API_URL : DEV_API_URL;
}

/**
 * Where this agent talks to, in order of who wins:
 *
 * 1. `DESKTOP_API_URL`, for pointing a local or CI build at staging.
 * 2. The server the person typed on the login screen, remembered on this
 *    machine. Hi Day is self-hostable, so most installs are not talking to
 *    hiday.io at all and must be able to say so without a custom build.
 * 3. Hi Day Cloud for a packaged app, localhost for `pnpm dev`.
 *
 * A *packaged* app (an installed .exe/.dmg/.AppImage) has no way to inherit
 * a developer's shell env vars, so it must never fall back to localhost —
 * `electron .` is the only case that should.
 */
export function resolveApiBaseUrl(
  isPackaged: boolean,
  /** What this install remembered from the login screen, if anything. */
  remembered: string | null = null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.DESKTOP_API_URL) return env.DESKTOP_API_URL;
  if (remembered) return remembered;
  return defaultApiBaseUrl(isPackaged);
}

/** Why a typed server address was rejected, or null if it is fine. */
export type ServerUrlProblem = string | null;

/**
 * Hosts allowed to be reached over plain HTTP.
 *
 * Everything else must be HTTPS: a device token travels on every request,
 * and over plain HTTP on a hostile network it is readable. These three are
 * the exception because the traffic never leaves the machine.
 */
const PLAIN_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Private address ranges, also allowed plain HTTP.
 *
 * A self-hosted Hi Day on an office LAN very often has no certificate, and
 * refusing it would make the product unusable for exactly the people it is
 * meant for. The traffic stays inside their network.
 */
function isPrivateHost(hostname: string): boolean {
  if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
    return true;
  }
  // 10.0.0.0/8, 192.168.0.0/16, and 172.16.0.0/12.
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
 * Checks a server address before anything is saved or sent to it.
 *
 * Deliberately strict about the scheme and quiet about everything else: a
 * typo in the host shows up immediately as "can't reach that server", which
 * is a clearer message than anything guessed here, while a typo in the
 * scheme would silently send credentials in the clear.
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

/**
 * Tidies a valid address into the one form that gets stored.
 *
 * A trailing slash matters: every request is built as `${base}/path`, so
 * "https://x/" would produce "https://x//path". Normalising once here means
 * no caller has to remember, and two people who typed the same server with
 * and without the slash end up on the same string.
 */
export function normaliseServerUrl(value: string): string {
  const url = new URL(value.trim());
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}
