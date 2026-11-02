import {
  defaultApiBaseUrl,
  normaliseServerUrl,
  resolveApiBaseUrl,
  validateServerUrl,
} from './api-base-url';
import { rememberedServerUrl, rememberServerUrl } from './setup-state';

/** What the login screen needs in order to draw the Server URL field. */
export interface ServerUrlState {
  /** The address in use right now. */
  url: string;
  /** Whether that is the built-in default rather than something chosen. */
  isDefault: boolean;
  /**
   * False where `DESKTOP_API_URL` is set, which wins over anything typed.
   * The field is shown read-only then, rather than hidden, so a developer
   * can see *why* their edit would have no effect.
   */
  canEdit: boolean;
}

export interface SaveServerUrlResult {
  ok: boolean;
  /** Why it was rejected, for the field's error line. */
  message?: string;
  /** The address now in use, saved or not. */
  url: string;
}

/**
 * Reads and changes which Hi Day server this agent talks to.
 *
 * Hi Day is self-hostable, so most installs are not talking to hiday.io.
 * Before this, the only way to point the agent elsewhere was an
 * environment variable a packaged app cannot see — which meant a
 * self-hoster had to build their own desktop app to use their own server.
 *
 * Probing is part of saving on purpose. The address is typed by hand, and
 * the next thing that happens after saving is a pairing flow that opens a
 * browser; "could not reach that server" said now is far clearer than a
 * pairing that silently never completes.
 */
export class ServerUrlSetting {
  constructor(
    private readonly userDataDir: string,
    private readonly isPackaged: boolean,
    private readonly env: NodeJS.ProcessEnv = process.env,
    /** Injected so tests do not reach the network. */
    private readonly probe: (url: string) => Promise<boolean> = reachable,
  ) {}

  /** The address in use, honouring the env override and what was saved. */
  current(): string {
    return resolveApiBaseUrl(
      this.isPackaged,
      rememberedServerUrl(this.userDataDir),
      this.env,
    );
  }

  state(): ServerUrlState {
    const url = this.current();
    return {
      url,
      isDefault: url === defaultApiBaseUrl(this.isPackaged),
      canEdit: !this.env.DESKTOP_API_URL,
    };
  }

  /**
   * Validates, checks the server answers, then saves.
   *
   * Nothing is written on a failure, so a typo leaves the working address
   * in place rather than stranding the app on an unreachable one.
   */
  async save(value: string): Promise<SaveServerUrlResult> {
    if (this.env.DESKTOP_API_URL) {
      return {
        ok: false,
        message:
          'DESKTOP_API_URL is set in this environment, so the server cannot be changed here.',
        url: this.current(),
      };
    }

    const problem = validateServerUrl(value);
    if (problem) {
      return { ok: false, message: problem, url: this.current() };
    }

    const candidate = normaliseServerUrl(value);
    if (!(await this.probe(candidate))) {
      return {
        ok: false,
        message: `Could not reach a Hi Day server at ${candidate}. Check the address and that the server is running.`,
        url: this.current(),
      };
    }

    rememberServerUrl(this.userDataDir, candidate);
    return { ok: true, url: candidate };
  }

  /** Forgets the chosen server, handing control back to the default. */
  reset(): ServerUrlState {
    rememberServerUrl(this.userDataDir, null);
    return this.state();
  }
}

/**
 * Whether a Hi Day backend answers at this address.
 *
 * Asks `/config`, the one endpoint with no guard on it — so a 200 means a
 * Hi Day server that is genuinely serving, not merely something listening
 * on the port. A short timeout because somebody is waiting on a form.
 */
async function reachable(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}/config`, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
