import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Runs the real renderer in jsdom against a stubbed `window.api`, to pin how
 * tracking setup behaves when its first requests fail.
 *
 * The case this exists for: the app autostarts at OS login, often before the
 * network is up, so the first `listProjects` answers "Could not reach the
 * server". That load used to run exactly once — the list stayed empty, the
 * real error was replaced by "No projects are available to track time
 * against.", and only logging out and back in (which reruns setup) fixed it.
 *
 * Lives under main/tests rather than beside the renderer because vitest only
 * collects `src/main`.
 */
const RENDERER_DIR = join(__dirname, '..', '..', 'renderer');

/** Shrunk so a retry on the poll cadence lands within a short real-time wait. */
const FAST_POLL_MS = 50;

function rendererScript(pollMs: number): string {
  const source = readFileSync(join(RENDERER_DIR, 'renderer.ts'), 'utf8');
  const fastSource = source.replace(
    'const STATUS_POLL_INTERVAL_MS = 15_000;',
    `const STATUS_POLL_INTERVAL_MS = ${pollMs};`,
  );
  // Guards the guard: a renamed constant would silently keep the 15s cadence.
  expect(fastSource).not.toBe(source);
  return ts
    .transpileModule(fastSource, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^export \{\};?$/m, '');
}

function rendererMarkup(): string {
  return readFileSync(join(RENDERER_DIR, 'index.html'), 'utf8').replace(
    /<script[\s\S]*?<\/script>/g,
    '',
  );
}

const PROJECT = { id: 'p1', name: 'Project One', colour: '#000000', client: null };
const UNREACHABLE = { ok: false, message: 'Could not reach the server at https://api.hiday.io.' };
/** What main's `callDeviceApi` hands back for a revoked (or locally cleared) session. */
const SIGNED_OUT = {
  ok: false,
  message: "You've been signed out — please log in to continue.",
  unauthorized: true,
  status: 401,
};

interface Scenario {
  /** How many leading `listProjects` calls fail as if the network were down. */
  failingProjectLoads: number;
  projects?: (typeof PROJECT)[];
  /** How many leading `idlePolicy` calls fail as if the network were down. */
  failingIdlePolicyLoads?: number;
  /** A timer already running server-side, e.g. started from the web console. */
  runningElsewhere?: boolean;
  /** Overrides the shrunk poll cadence — a long one means no retry fires on its own. */
  pollMs?: number;
}

function launch(scenario: Scenario) {
  const dom = new JSDOM(rendererMarkup(), { runScripts: 'outside-only', pretendToBeVisual: true });
  const window = dom.window as unknown as Window & { api: unknown; eval: (code: string) => void };

  const calls = { listProjects: 0, start: 0, status: 0, idlePolicy: 0 };
  const entry = {
    id: 'e1',
    projectId: PROJECT.id,
    taskId: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
  };
  let running: typeof entry | null = scenario.runningElsewhere ? entry : null;
  /** Flip `revoked` mid-test to sign the device out server-side. */
  const server = { revoked: false };
  const ok = <T>(data: T) =>
    Promise.resolve(server.revoked ? SIGNED_OUT : { ok: true, data });

  window.api = {
    getStatus: () =>
      Promise.resolve({ loggedIn: true, email: 'a@b.c', name: 'A', organisationName: 'Org' }),
    auth: {
      startPairing: () => ok({}),
      pairingStatus: () => Promise.resolve({ status: 'pending' }),
    },
    logout: () => Promise.resolve({ loggedIn: false }),
    tracking: {
      listProjects: () => {
        calls.listProjects += 1;
        if (!server.revoked && calls.listProjects <= scenario.failingProjectLoads) {
          return Promise.resolve(UNREACHABLE);
        }
        return ok(scenario.projects ?? [PROJECT]);
      },
      listTasks: () => ok({ tasks: [] }),
      start: () => {
        calls.start += 1;
        if (!server.revoked) running = entry;
        return ok(entry);
      },
      switchTo: () => ok(entry),
      stop: () => ok(entry),
      status: () => {
        calls.status += 1;
        return ok({ entry: running, now: new Date().toISOString(), workedSeconds: 0 });
      },
      // Pausing ends the entry, as the backend does now.
      pause: () => {
        if (!server.revoked) running = null;
        return ok({ ...entry, endedAt: new Date().toISOString() });
      },
      resume: () => ok(entry),
      lastProject: () => Promise.resolve(null),
      entriesBetween: () => ok([]),
      idlePolicy: () => {
        calls.idlePolicy += 1;
        if (!server.revoked && calls.idlePolicy <= (scenario.failingIdlePolicyLoads ?? 0)) {
          return Promise.resolve(UNREACHABLE);
        }
        return ok({ handling: 'ignore', thresholdMinutes: 5 });
      },
      permissionStatus: () =>
        ok({
          windowTrackingEnabled: false,
          screenshotsEnabled: false,
          platform: 'linux',
          screenRecordingGranted: true,
          accessibilityGranted: true,
          accessibilityGuidance: '',
          waylandUnsupported: false,
        }),
      requestScreenRecordingAccess: () => Promise.resolve(),
      openPrivacySettings: () => Promise.resolve(),
    },
    idle: { seconds: () => Promise.resolve(0) },
    urlCapture: { timerStateChanged: () => {} },
    windowControls: {
      minimise: async () => {},
      show: async () => {},
      close: async () => {},
      setCompact: async () => {},
    },
    setup: {
      browserRestartPrompt: () =>
        Promise.resolve({ show: false, names: [], manual: [], warnings: [] }),
      continueFromBrowserRestart: async () => {},
    },
    update: {
      status: () => Promise.resolve({ updateAvailable: false }),
      openReleasesPage: async () => {},
      autoStatus: () => Promise.resolve({ phase: 'idle' }),
    },
  };

  window.eval(rendererScript(scenario.pollMs ?? FAST_POLL_MS));

  const document = dom.window.document;
  return {
    calls,
    server,
    isRunning: () => running !== null,
    projectCount: () => document.getElementById('project-count')!.textContent,
    trackingError: () => {
      const el = document.getElementById('tracking-error')!;
      return el.hidden ? null : el.textContent;
    },
    visibleView: () =>
      [...document.querySelectorAll<HTMLElement>('#login-view, #status-view')].find(
        (el) => !el.hidden,
      )?.id,
    clickLogout: () => document.getElementById('logout-button')!.click(),
    clickPlay: () => document.getElementById('timer-toggle')!.click(),
    /** The toggle disables itself while a click is in flight and ignores clicks meanwhile. */
    playReady: () => !(document.getElementById('timer-toggle') as HTMLButtonElement).disabled,
    close: () => dom.window.close(),
  };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls rather than sleeping a fixed time, so a slow CI runner can't flake it. */
async function waitFor(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return; // let the assertions below report what's wrong
    await settle(10);
  }
}

describe('renderer tracking setup recovers from a failed first load', () => {
  it('loads projects and starts the timer once the server becomes reachable', async () => {
    const app = launch({ failingProjectLoads: 1 });
    await waitFor(() => app.isRunning());

    expect(app.projectCount()).toBe('1');
    expect(app.isRunning()).toBe(true);
    expect(app.trackingError()).toBeNull();
    app.close();
  });

  it('keeps retrying through several failures', async () => {
    const app = launch({ failingProjectLoads: 4 });
    await waitFor(() => app.isRunning());

    expect(app.projectCount()).toBe('1');
    expect(app.isRunning()).toBe(true);
    app.close();
  });

  it('shows the real error while waiting, not "No projects are available"', async () => {
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY });
    await waitFor(() => app.calls.listProjects >= 2);

    expect(app.trackingError()).toContain('Could not reach the server');
    expect(app.calls.start).toBe(0);
    app.close();
  });

  it('stops retrying once signed out', async () => {
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY });
    await settle(FAST_POLL_MS / 2);
    app.clickLogout();
    await settle(FAST_POLL_MS);
    const callsAtSignOut = app.calls.listProjects;
    await settle(FAST_POLL_MS * 6);

    expect(app.calls.listProjects).toBe(callsAtSignOut);
    expect(app.visibleView()).toBe('login-view');
    app.close();
  });

  it('does not stack status polling after recovering', async () => {
    const control = launch({ failingProjectLoads: 0 });
    const recovered = launch({ failingProjectLoads: 3 });
    await waitFor(() => recovered.calls.idlePolicy > 0 && control.calls.idlePolicy > 0);
    await settle(FAST_POLL_MS * 2);

    const controlBaseline = control.calls.status;
    const recoveredBaseline = recovered.calls.status;
    await settle(FAST_POLL_MS * 10);
    const controlRate = control.calls.status - controlBaseline;
    const recoveredRate = recovered.calls.status - recoveredBaseline;

    // One interval each — a duplicated interval would roughly double it.
    expect(recoveredRate).toBeLessThanOrEqual(controlRate + 2);
    expect(recovered.calls.idlePolicy).toBeGreaterThanOrEqual(1);
    control.close();
    recovered.close();
  });

  it('adopts a timer already running elsewhere instead of starting one', async () => {
    const app = launch({ failingProjectLoads: 2, runningElsewhere: true });
    await waitFor(() => app.projectCount() === '1' && app.calls.status > 0);
    await settle(FAST_POLL_MS);

    expect(app.projectCount()).toBe('1');
    expect(app.calls.start).toBe(0);
    app.close();
  });

  it('still says "No projects" when the account genuinely has none', async () => {
    const app = launch({ failingProjectLoads: 0, projects: [] });
    await waitFor(() => app.trackingError() !== null);

    expect(app.trackingError()).toBe('No projects are available to track time against.');
    app.close();
  });
});

describe('renderer idle policy', () => {
  it('refetches the idle policy on a later poll when the first load failed', async () => {
    const app = launch({ failingProjectLoads: 0, failingIdlePolicyLoads: 1 });
    await waitFor(() => app.calls.idlePolicy >= 2);

    expect(app.calls.idlePolicy).toBeGreaterThanOrEqual(2);
    expect(app.isRunning()).toBe(true);
    app.close();
  });

  it('stops refetching once the idle policy has loaded', async () => {
    const app = launch({ failingProjectLoads: 0, failingIdlePolicyLoads: 1 });
    await waitFor(() => app.calls.idlePolicy >= 2);
    const callsOnceLoaded = app.calls.idlePolicy;
    await settle(FAST_POLL_MS * 6);

    expect(app.calls.idlePolicy).toBe(callsOnceLoaded);
    app.close();
  });
});

describe('renderer asks for login before the timer can start on an ended session', () => {
  it('shows the login view at launch instead of starting the timer', async () => {
    const app = launch({ failingProjectLoads: 0 });
    app.server.revoked = true;
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('shows the login view when play is pressed after the session ended', async () => {
    // Long poll: nothing but the click itself can discover the sign-out.
    const app = launch({ failingProjectLoads: 0, pollMs: 60_000 });
    await waitFor(() => app.isRunning());
    app.clickPlay(); // pause
    await waitFor(() => !app.isRunning() && app.playReady());
    app.server.revoked = true;
    app.clickPlay();
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    expect(app.isRunning()).toBe(false);
    app.close();
  });

  it('checks the session when play is pressed while projects never loaded', async () => {
    // Long poll: the scheduled retry won't fire, so the click must reach the server.
    const app = launch({ failingProjectLoads: Number.POSITIVE_INFINITY, pollMs: 60_000 });
    await waitFor(() => app.trackingError() !== null);
    app.server.revoked = true;
    app.clickPlay();
    await waitFor(() => app.visibleView() === 'login-view');

    expect(app.visibleView()).toBe('login-view');
    expect(app.trackingError()).toBeNull();
    app.close();
  });

  it('starts the timer when play is pressed once the server is reachable again', async () => {
    const app = launch({ failingProjectLoads: 1, pollMs: 60_000 });
    await waitFor(() => app.trackingError() !== null);
    app.clickPlay();
    await waitFor(() => app.isRunning());

    expect(app.projectCount()).toBe('1');
    expect(app.isRunning()).toBe(true);
    app.close();
  });
});
