export {};

interface AuthStatus {
  loggedIn: boolean;
  email?: string;
  message?: string;
}

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

type DesktopDevicePlatformName = 'windows' | 'macos' | 'linux';

interface CapturePermissionStatus {
  windowTrackingEnabled: boolean;
  platform: DesktopDevicePlatformName;
  accessibilityGranted: boolean;
  waylandUnsupported: boolean;
}

type TrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; runningEntry?: TimeEntry };

declare global {
  interface Window {
    api: {
      getStatus: () => Promise<AuthStatus>;
      login: (email: string, password: string) => Promise<AuthStatus>;
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
        permissionStatus: () => Promise<TrackingResult<CapturePermissionStatus>>;
        requestAccessibilityAccess: () => Promise<void>;
        openAccessibilitySettings: () => Promise<void>;
      };
      idle: {
        seconds: () => Promise<number>;
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
// After "Grant Access" is clicked, macOS gives no callback for when the
// person actually flips the switch in System Settings — poll a few times
// a second for a short window to detect it and auto-dismiss the banner.
const ACCESSIBILITY_POLL_INTERVAL_MS = 2_500;
const ACCESSIBILITY_POLL_TIMEOUT_MS = 30_000;

function show(viewId: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(
    '#loading-view, #login-view, #status-view',
  )) {
    el.hidden = el.id !== viewId;
  }
}

function showLoggedIn(email: string): void {
  document.getElementById('status-email')!.textContent = email;
  show('status-view');
  void initTracking();
}

function showLoginForm(message?: string): void {
  const errorEl = document.getElementById('login-error')!;
  errorEl.hidden = !message;
  errorEl.textContent = message ?? '';
  show('login-view');
  stopPolling();
}

async function init(): Promise<void> {
  const status = await window.api.getStatus();
  if (status.loggedIn && status.email) {
    showLoggedIn(status.email);
  } else {
    showLoginForm();
  }
}

document.getElementById('login-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const email = (form.elements.namedItem('email') as HTMLInputElement).value;
  const password = (form.elements.namedItem('password') as HTMLInputElement).value;

  void window.api.login(email, password).then((result) => {
    if (result.loggedIn && result.email) {
      showLoggedIn(result.email);
    } else {
      showLoginForm(result.message ?? 'Login failed.');
    }
  });
});

document.getElementById('logout-button')!.addEventListener('click', () => {
  void window.api.logout().then(() => showLoginForm());
});

// --- Time tracking -----------------------------------------------------

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
const accessibilityBanner = document.getElementById('accessibility-banner')!;
const accessibilityGrantButton = document.getElementById(
  'accessibility-grant-button',
) as HTMLButtonElement;
const accessibilitySettingsButton = document.getElementById(
  'accessibility-settings-button',
) as HTMLButtonElement;
const waylandNotice = document.getElementById('wayland-notice')!;

let pollHandle: ReturnType<typeof setInterval> | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let idlePollHandle: ReturnType<typeof setInterval> | null = null;
let accessibilityPollHandle: ReturnType<typeof setInterval> | null = null;
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
    const result = await window.api.tracking.stop(idleStartedAtIso);
    if (result.ok) {
      setRunning(null);
      showIdleNotice(`Timer stopped automatically after ${idleMinutes} min idle.`);
    }
    return;
  }

  showIdleBanner(idleMinutes, idleStartedAtIso);
}

// --- Window-tracking permission banner ----------------------------------

async function refreshCapturePermissionBanner(): Promise<CapturePermissionStatus | null> {
  const result = await window.api.tracking.permissionStatus();
  if (!result.ok) return null;
  const status = result.data;

  accessibilityBanner.hidden = !(
    status.windowTrackingEnabled &&
    status.platform === 'macos' &&
    !status.accessibilityGranted
  );
  // Wayland has no fix available, so this is informational only — no
  // "Grant Access"-style call to action, unlike the accessibility banner.
  waylandNotice.hidden = !(status.windowTrackingEnabled && status.waylandUnsupported);

  return status;
}

function stopAccessibilityGrantPolling(): void {
  if (accessibilityPollHandle) clearInterval(accessibilityPollHandle);
  accessibilityPollHandle = null;
}

accessibilityGrantButton.addEventListener('click', () => {
  void window.api.tracking.requestAccessibilityAccess().then(() => {
    // macOS won't re-show its native prompt on repeat calls, so grant
    // detection has to be polled rather than awaited — stop as soon as
    // access is detected, or after a bounded timeout either way.
    stopAccessibilityGrantPolling();
    const deadline = Date.now() + ACCESSIBILITY_POLL_TIMEOUT_MS;
    accessibilityPollHandle = setInterval(() => {
      void (async () => {
        const status = await refreshCapturePermissionBanner();
        if (status?.accessibilityGranted || Date.now() > deadline) {
          stopAccessibilityGrantPolling();
        }
      })();
    }, ACCESSIBILITY_POLL_INTERVAL_MS);
  });
});

accessibilitySettingsButton.addEventListener('click', () => {
  void window.api.tracking.openAccessibilitySettings();
});

async function loadProjects(): Promise<void> {
  const result = await window.api.tracking.listProjects();
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
  const result = await window.api.tracking.listTasks(projectId);
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
  const result = await window.api.tracking.status();
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
  pollHandle = setInterval(() => {
    void refreshStatus();
    void refreshCapturePermissionBanner();
  }, STATUS_POLL_INTERVAL_MS);
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
  stopAccessibilityGrantPolling();
}

startButton.addEventListener('click', () => {
  void (async () => {
    clearTrackingError();
    const projectId = projectSelect.value;
    if (!projectId) return;
    const taskId = taskSelect.value || null;

    const result = await window.api.tracking.start(projectId, taskId);
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
    const result = await window.api.tracking.stop();
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
    const result = await window.api.tracking.switchTo(projectId, taskId);
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

    const result = await window.api.tracking.stop(discardAt);
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

  const idlePolicyResult = await window.api.tracking.idlePolicy();
  idlePolicy = idlePolicyResult.ok ? idlePolicyResult.data : null;

  void refreshCapturePermissionBanner();
  startPolling();
}

void init();
