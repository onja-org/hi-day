export {};

interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  organisationName?: string;
}

interface StartPairingResult {
  ok: boolean;
  message?: string;
}

type PairingPollResult =
  | { status: 'pending' }
  | { status: 'approved'; email: string; organisationName: string }
  | { status: 'expired' }
  | { status: 'error'; message: string };

interface TrackedProject {
  id: string;
  name: string;
  colour: string;
  client: string | null;
}

interface TrackedTask {
  id: string;
  name: string;
  status: 'open' | 'closed';
}

interface TimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
}

interface CurrentTimer {
  entry: TimeEntry | null;
  now: string;
}

type IdleHandling = 'off' | 'flag' | 'auto_subtract';

interface IdlePolicy {
  handling: IdleHandling;
  thresholdMinutes: number;
}

type TrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; runningEntry?: TimeEntry; signedOut?: boolean };

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion?: string;
}

declare global {
  interface Window {
    api: {
      getStatus: () => Promise<AuthStatus>;
      auth: {
        startPairing: () => Promise<StartPairingResult>;
        pairingStatus: () => Promise<PairingPollResult>;
      };
      logout: () => Promise<AuthStatus>;
      tracking: {
        listProjects: () => Promise<TrackingResult<TrackedProject[]>>;
        listTasks: (projectId: string) => Promise<TrackingResult<{ tasks: TrackedTask[] }>>;
        start: (projectId: string, taskId: string | null) => Promise<TrackingResult<TimeEntry>>;
        switchTo: (
          projectId: string,
          taskId: string | null,
        ) => Promise<TrackingResult<TimeEntry>>;
        stop: (endedAt?: string) => Promise<TrackingResult<TimeEntry>>;
        status: () => Promise<TrackingResult<CurrentTimer>>;
        idlePolicy: () => Promise<TrackingResult<IdlePolicy>>;
      };
      idle: {
        seconds: () => Promise<number>;
      };
      update: {
        status: () => Promise<UpdateCheckResult>;
        openReleasesPage: () => Promise<void>;
      };
    };
  }
}

// How often the agent re-syncs with the server's own idea of what's
// running — catches a timer started/stopped from the web console, and
// keeps the elapsed display correct even if this device's clock drifts.
const STATUS_POLL_INTERVAL_MS = 15_000;
// How often the agent checks the OS's own idle-time counter while a timer
// is running. Only matters while `idlePolicy.handling !== 'off'`.
const IDLE_POLL_INTERVAL_MS = 10_000;
// How often — and for how long — the agent checks whether the pairing
// code it just opened in the browser has been approved yet. Bounded
// rather than indefinite so an abandoned pairing attempt (browser tab
// closed, person distracted) doesn't poll forever; the pairing code
// itself lives for longer than this on the backend, so clicking "Log in"
// again after this gives up just starts a fresh one.
const PAIRING_POLL_INTERVAL_MS = 3_000;
const PAIRING_POLL_MAX_ATTEMPTS = 60;
const DEFAULT_PAIRING_MESSAGE = 'Sign in from your browser to link this device.';

function show(viewId: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(
    '#loading-view, #login-view, #status-view',
  )) {
    el.hidden = el.id !== viewId;
  }
}

function showLoggedIn(organisationName: string): void {
  document.getElementById('organisation-name')!.textContent = organisationName;
  show('status-view');
  void initTracking();
}

const pairingStatusEl = document.getElementById('pairing-status')!;
const pairingErrorEl = document.getElementById('pairing-error')!;
const loginButton = document.getElementById('login-button') as HTMLButtonElement;

let pairingPollHandle: ReturnType<typeof setInterval> | null = null;
let pairingPollAttempts = 0;

function stopPairingPoll(): void {
  if (pairingPollHandle) clearInterval(pairingPollHandle);
  pairingPollHandle = null;
  pairingPollAttempts = 0;
}

function showLoginView(errorMessage?: string): void {
  pairingErrorEl.hidden = !errorMessage;
  pairingErrorEl.textContent = errorMessage ?? '';
  pairingStatusEl.textContent = DEFAULT_PAIRING_MESSAGE;
  loginButton.disabled = false;
  loginButton.textContent = 'Log in';
  show('login-view');
  stopPolling();
  stopPairingPoll();
}

const updateBannerEl = document.getElementById('update-banner')!;
const updateMessageEl = document.getElementById('update-message')!;

async function checkForUpdate(): Promise<void> {
  const result = await window.api.update.status();
  if (!result.updateAvailable) return;

  updateMessageEl.textContent = result.latestVersion
    ? `Version ${result.latestVersion} is available.`
    : 'A new version is available.';
  updateBannerEl.hidden = false;
}

document.getElementById('update-button')!.addEventListener('click', () => {
  void window.api.update.openReleasesPage();
});

document.getElementById('update-dismiss')!.addEventListener('click', () => {
  updateBannerEl.hidden = true;
});

async function init(): Promise<void> {
  void checkForUpdate();

  const status = await window.api.getStatus();
  if (status.loggedIn && status.organisationName) {
    showLoggedIn(status.organisationName);
  } else {
    showLoginView();
  }
}

async function pollPairing(): Promise<void> {
  pairingPollAttempts += 1;
  const result = await window.api.auth.pairingStatus();

  if (result.status === 'approved') {
    stopPairingPoll();
    showLoggedIn(result.organisationName);
    return;
  }

  if (result.status === 'error') {
    stopPairingPoll();
    showLoginView(result.message);
    return;
  }

  if (result.status === 'expired' || pairingPollAttempts >= PAIRING_POLL_MAX_ATTEMPTS) {
    stopPairingPoll();
    showLoginView('That login link expired. Click "Log in" to try again.');
    return;
  }

  // status === 'pending' — keep waiting.
}

loginButton.addEventListener('click', () => {
  void (async () => {
    loginButton.disabled = true;
    pairingErrorEl.hidden = true;
    pairingStatusEl.textContent = 'Opening your browser…';

    const result = await window.api.auth.startPairing();
    if (!result.ok) {
      showLoginView(result.message ?? 'Could not start login.');
      return;
    }

    pairingStatusEl.textContent = 'Waiting for you to approve in your browser…';
    stopPairingPoll();
    pairingPollHandle = setInterval(() => void pollPairing(), PAIRING_POLL_INTERVAL_MS);
  })();
});

document.getElementById('logout-button')!.addEventListener('click', () => {
  void window.api.logout().then(() => showLoginView());
});

// --- Time tracking -----------------------------------------------------

/**
 * Runs a tracking call and, if the response says the device itself has
 * been signed out (see api-client.ts's `signedOut` — set specifically for
 * a 401, not any other failure), drops back to the login view instead of
 * just surfacing the error message and leaving the UI thinking it's still
 * logged in. This is how "log out from the web app" (ADR-0009) reaches
 * the desktop — there's no push channel, so it's discovered the next time
 * this device happens to call the backend.
 */
async function callTracking<T>(
  fn: () => Promise<TrackingResult<T>>,
): Promise<TrackingResult<T>> {
  const result = await fn();
  if (!result.ok && result.signedOut) {
    showLoginView("You've been signed out — please log in to continue.");
  }
  return result;
}

const projectSelect = document.getElementById('project-select') as HTMLSelectElement;
const taskSelect = document.getElementById('task-select') as HTMLSelectElement;
const timerDisplay = document.getElementById('timer-display')!;
const trackingError = document.getElementById('tracking-error')!;
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const stopButton = document.getElementById('stop-button') as HTMLButtonElement;
const switchButton = document.getElementById('switch-button') as HTMLButtonElement;
const idleBanner = document.getElementById('idle-banner')!;
const idleBannerMessage = document.getElementById('idle-banner-message')!;
const idleKeepButton = document.getElementById('idle-keep-button') as HTMLButtonElement;
const idleDiscardButton = document.getElementById('idle-discard-button') as HTMLButtonElement;
const idleNotice = document.getElementById('idle-notice')!;

let pollHandle: ReturnType<typeof setInterval> | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let idlePollHandle: ReturnType<typeof setInterval> | null = null;
let runningEntry: TimeEntry | null = null;
// Server clock minus local clock, at the moment of the last successful
// poll — lets the 1s tick compute elapsed time from the server's own
// notion of "now" instead of trusting this device's clock.
let serverOffsetMs = 0;
let pendingSwitch: { projectId: string; taskId: string | null } | null = null;

let idlePolicy: IdlePolicy | null = null;
// The OS idle-time counter only ever decreases when real input happens —
// comparing consecutive polls is how we detect "the person came back" and
// re-arm the prompt for the *next* idle stretch, rather than only ever
// firing once per app session.
let lastIdleSeconds = 0;
let idleHandled = false;
let pendingIdleDiscardAt: string | null = null;

function showTrackingError(message: string): void {
  trackingError.textContent = message;
  trackingError.hidden = false;
}

function clearTrackingError(): void {
  trackingError.hidden = true;
  switchButton.hidden = true;
  pendingSwitch = null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

function tick(): void {
  if (!runningEntry) {
    timerDisplay.hidden = true;
    return;
  }
  const startedAtMs = new Date(runningEntry.startedAt).getTime();
  const elapsed = Date.now() + serverOffsetMs - startedAtMs;
  timerDisplay.hidden = false;
  timerDisplay.textContent = formatElapsed(elapsed);
}

function setRunning(entry: TimeEntry | null): void {
  runningEntry = entry;
  startButton.hidden = entry !== null;
  stopButton.hidden = entry === null;
  projectSelect.disabled = entry !== null;
  taskSelect.disabled = entry !== null;
  if (!entry) {
    idleHandled = false;
    lastIdleSeconds = 0;
    hideIdleBanner();
  }
  tick();
}

function showIdleBanner(idleMinutes: number, idleStartedAtIso: string): void {
  pendingIdleDiscardAt = idleStartedAtIso;
  idleBannerMessage.textContent = `You've been idle for ${idleMinutes} min. Keep this time as tracked, or discard it?`;
  idleBanner.hidden = false;
}

function hideIdleBanner(): void {
  idleBanner.hidden = true;
  pendingIdleDiscardAt = null;
}

function showIdleNotice(message: string): void {
  idleNotice.textContent = message;
  idleNotice.hidden = false;
  setTimeout(() => {
    idleNotice.hidden = true;
  }, 8_000);
}

async function checkIdle(): Promise<void> {
  if (!runningEntry || !idlePolicy || idlePolicy.handling === 'off') return;

  const idleSeconds = await window.api.idle.seconds();
  const thresholdSeconds = idlePolicy.thresholdMinutes * 60;

  if (idleSeconds < lastIdleSeconds) {
    // Real input happened since the last check.
    idleHandled = false;
    hideIdleBanner();
  }
  lastIdleSeconds = idleSeconds;

  if (idleSeconds < thresholdSeconds || idleHandled) return;

  idleHandled = true;
  const idleMinutes = Math.floor(idleSeconds / 60);
  const idleStartedAtIso = new Date(
    Date.now() + serverOffsetMs - idleSeconds * 1000,
  ).toISOString();

  if (idlePolicy.handling === 'auto_subtract') {
    const result = await callTracking(() =>
      window.api.tracking.stop(idleStartedAtIso),
    );
    if (result.ok) {
      setRunning(null);
      showIdleNotice(`Timer stopped automatically after ${idleMinutes} min idle.`);
    }
    return;
  }

  showIdleBanner(idleMinutes, idleStartedAtIso);
}

async function loadProjects(): Promise<void> {
  const result = await callTracking(() => window.api.tracking.listProjects());
  if (!result.ok) {
    showTrackingError(result.message);
    return;
  }

  projectSelect.innerHTML = '';
  for (const project of result.data) {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.client ? `${project.name} (${project.client})` : project.name;
    projectSelect.appendChild(option);
  }

  if (result.data.length > 0) {
    await loadTasks(result.data[0].id);
  }
}

async function loadTasks(projectId: string): Promise<void> {
  const result = await callTracking(() =>
    window.api.tracking.listTasks(projectId),
  );
  taskSelect.innerHTML = '<option value="">No task</option>';
  if (!result.ok) {
    showTrackingError(result.message);
    return;
  }

  for (const task of result.data.tasks) {
    if (task.status === 'closed') continue;
    const option = document.createElement('option');
    option.value = task.id;
    option.textContent = task.name;
    taskSelect.appendChild(option);
  }
}

projectSelect.addEventListener('change', () => {
  if (projectSelect.value) {
    void loadTasks(projectSelect.value);
  }
});

async function refreshStatus(): Promise<void> {
  const result = await callTracking(() => window.api.tracking.status());
  if (!result.ok) {
    // A transient/offline failure shouldn't wipe the currently-displayed
    // timer — just skip this poll and try again next interval.
    return;
  }
  serverOffsetMs = new Date(result.data.now).getTime() - Date.now();
  setRunning(result.data.entry);
}

function startPolling(): void {
  stopPolling();
  void refreshStatus();
  pollHandle = setInterval(() => void refreshStatus(), STATUS_POLL_INTERVAL_MS);
  tickHandle = setInterval(tick, 1000);
  idlePollHandle = setInterval(() => void checkIdle(), IDLE_POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollHandle) clearInterval(pollHandle);
  if (tickHandle) clearInterval(tickHandle);
  if (idlePollHandle) clearInterval(idlePollHandle);
  pollHandle = null;
  tickHandle = null;
  idlePollHandle = null;
}

startButton.addEventListener('click', () => {
  void (async () => {
    clearTrackingError();
    const projectId = projectSelect.value;
    if (!projectId) return;
    const taskId = taskSelect.value || null;

    const result = await callTracking(() =>
      window.api.tracking.start(projectId, taskId),
    );
    if (result.ok) {
      setRunning(result.data);
      return;
    }

    showTrackingError(result.message);
    if (result.runningEntry) {
      pendingSwitch = { projectId, taskId };
      switchButton.hidden = false;
    }
  })();
});

stopButton.addEventListener('click', () => {
  void (async () => {
    clearTrackingError();
    const result = await callTracking(() => window.api.tracking.stop());
    if (result.ok) {
      setRunning(null);
    } else {
      showTrackingError(result.message);
    }
  })();
});

switchButton.addEventListener('click', () => {
  void (async () => {
    if (!pendingSwitch) return;
    const { projectId, taskId } = pendingSwitch;
    const result = await callTracking(() =>
      window.api.tracking.switchTo(projectId, taskId),
    );
    if (result.ok) {
      clearTrackingError();
      setRunning(result.data);
    } else {
      showTrackingError(result.message);
    }
  })();
});

idleKeepButton.addEventListener('click', () => {
  hideIdleBanner();
});

idleDiscardButton.addEventListener('click', () => {
  void (async () => {
    if (!pendingIdleDiscardAt) return;
    const discardAt = pendingIdleDiscardAt;
    hideIdleBanner();

    const result = await callTracking(() => window.api.tracking.stop(discardAt));
    if (result.ok) {
      setRunning(null);
    } else {
      showTrackingError(result.message);
    }
  })();
});

async function initTracking(): Promise<void> {
  clearTrackingError();
  await loadProjects();

  const idlePolicyResult = await callTracking(() =>
    window.api.tracking.idlePolicy(),
  );
  idlePolicy = idlePolicyResult.ok ? idlePolicyResult.data : null;

  startPolling();
}

void init();
