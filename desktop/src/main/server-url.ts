import {
  defaultApiBaseUrl,
  normaliseServerUrl,
  resolveApiBaseUrl,
  validateServerUrl,
} from './api-base-url';
import { rememberedServerUrl, rememberServerUrl } from './setup-state';

export interface ServerUrlState {
  url: string;
  isDefault: boolean;
  /** False where `DESKTOP_API_URL` is set, which wins over anything typed. */
  canEdit: boolean;
}

export interface SaveServerUrlResult {
  ok: boolean;
  message?: string;
  /** The address now in use, saved or not. */
  url: string;
}

/**
 * Which Hi Day server this agent talks to. Saving probes the address first,
 * because the next step is a pairing flow that opens a browser — a clear
 * "could not reach that server" beats a pairing that never completes.
 */
export class ServerUrlSetting {
  constructor(
    private readonly userDataDir: string,
    private readonly isPackaged: boolean,
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly probe: (url: string) => Promise<boolean> = reachable,
  ) {}

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

  /** Nothing is written on a failure, so a typo leaves the working address
   * in place. */
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

  /** Hands control back to the built-in default. */
  reset(): ServerUrlState {
    rememberServerUrl(this.userDataDir, null);
    return this.state();
  }
}

/** `/config` is unguarded, so a 200 means a Hi Day server genuinely
 * serving rather than anything listening on the port. */
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
