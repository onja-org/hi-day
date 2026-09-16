export {};

// AuthStatus/TrackedProject/.../Window.api are declared once, ambiently,
// in window.d.ts — shared across every renderer entry point.

// How often the agent re-syncs with the server's own idea of what's
// running — catches a timer started/stopped from the web console, and
// keeps the elapsed display correct even if this device's clock drifts.
const STATUS_POLL_INTERVAL_MS = 15_000;
// How often the agent checks the OS's own idle-time counter while a timer
// is running. Only matters while `idlePolicy.handling !== 'off'`.
const IDLE_POLL_INTERVAL_MS = 10_000;
// Bounded so an abandoned pairing attempt stops polling, not so this races
// the backend's own expiry. Must stay comfortably ABOVE the 10-minute
// PAIRING_TTL_MS in backend/src/devices/services/device-pairing.service.ts —
// this used to be a 3-minute ceiling (60 attempts), which cut off well
// before a normal first-time login (open the browser, type credentials,
// click through) reliably finishes, always showing "link expired" even
// though the code was still good server-side. 210 attempts (10.5 minutes)
// gives a small buffer past the real TTL so "expired" only ever reflects
// the server's own answer, never this client guessing early.
const PAIRING_POLL_INTERVAL_MS = 3_000;
const PAIRING_POLL_MAX_ATTEMPTS = 210;
const DEFAULT_PAIRING_MESSAGE =
  "Sign in from your browser to link this device.";
// After "Grant Access" is clicked, macOS gives no callback for when the
// person actually flips the switch in System Settings — poll a few times
// a second for a short window to detect it and auto-dismiss the banner.
const SCREEN_RECORDING_POLL_INTERVAL_MS = 2_500;
const SCREEN_RECORDING_POLL_TIMEOUT_MS = 30_000;

function show(viewId: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(
    "#loading-view, #login-view, #status-view",
  )) {
    el.hidden = el.id !== viewId;
  }
}

/**
 * Login and tracking are never blocked on disclosure (see docs/adr/0015-...)
 * — the passive notice banner is refreshed independently, in parallel with
 * starting the normal tracking view, not as a gate in front of it.
 */
function showLoggedIn(organisationName: string): void {
  document.getElementById("organisation-name")!.textContent = organisationName;

  show("status-view");
  void initTracking();
  void refreshDisclosureBanner();
}

const pairingStatusEl = document.getElementById("pairing-status")!;
const pairingErrorEl = document.getElementById("pairing-error")!;
const loginButton = document.getElementById(
  "login-button",
) as HTMLButtonElement;

let pairingPollHandle: ReturnType<typeof setInterval> | null = null;
let pairingPollAttempts = 0;

function stopPairingPoll(): void {
  if (pairingPollHandle) clearInterval(pairingPollHandle);
  pairingPollHandle = null;
  pairingPollAttempts = 0;
}

function showLoginView(errorMessage?: string): void {
  // Signing out is more than a view swap. Cleared first so the re-render
  // below empties the list rather than redrawing the old user's projects.
  projects = [];
  todaySecondsByProject = new Map();
  // Stops the clock, tells main to stop url-capture, and clears the row
  // highlight — otherwise the timer keeps counting behind the login screen.
  setRunning(null);
  clearTrackingError();
  timerDisplay.hidden = true;

  pairingErrorEl.hidden = !errorMessage;
  pairingErrorEl.textContent = errorMessage ?? "";
  pairingStatusEl.textContent = DEFAULT_PAIRING_MESSAGE;
  loginButton.disabled = false;
  loginButton.textContent = "Log in";
  show("login-view");
  stopPolling();
  stopPairingPoll();
}

const updateBannerEl = document.getElementById("update-banner")!;
const updateMessageEl = document.getElementById("update-message")!;

async function checkForUpdate(): Promise<void> {
  const result = await window.api.update.status();
  if (!result.updateAvailable) return;

  updateMessageEl.textContent = result.latestVersion
    ? `Version ${result.latestVersion} is available.`
    : "A new version is available.";
  updateBannerEl.hidden = false;
}

document.getElementById("update-button")!.addEventListener("click", () => {
  void window.api.update.openReleasesPage();
});

document.getElementById("update-dismiss")!.addEventListener("click", () => {
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

  if (result.status === "approved") {
    stopPairingPoll();
    showLoggedIn(result.organisationName);
    return;
  }

  if (result.status === "error") {
    stopPairingPoll();
    showLoginView(result.message);
    return;
  }

  if (
    result.status === "expired" ||
    pairingPollAttempts >= PAIRING_POLL_MAX_ATTEMPTS
  ) {
    stopPairingPoll();
    showLoginView('That login link expired. Click "Log in" to try again.');
    return;
  }

  // status === 'pending' — keep waiting.
}

loginButton.addEventListener("click", () => {
  void (async () => {
    loginButton.disabled = true;
    pairingErrorEl.hidden = true;
    pairingStatusEl.textContent = "Opening your browser…";

    const result = await window.api.auth.startPairing();
    if (!result.ok) {
      showLoginView(result.message ?? "Could not start login.");
      return;
    }

    pairingStatusEl.textContent = "Waiting for you to approve in your browser…";
    stopPairingPoll();
    pairingPollHandle = setInterval(
      () => void pollPairing(),
      PAIRING_POLL_INTERVAL_MS,
    );
  })();
});

document.getElementById("logout-button")!.addEventListener("click", () => {
  void window.api.logout().then(() => showLoginView());
});

// --- Time tracking -----------------------------------------------------

const projectList = document.getElementById("project-list") as HTMLUListElement;
const taskSelect = document.getElementById("task-select") as HTMLSelectElement;
const timerDisplay = document.getElementById("timer-display")!;
const trackingError = document.getElementById("tracking-error")!;
const timerToggle = document.getElementById(
  "timer-toggle",
) as HTMLButtonElement;
// Typed as Element, not HTMLElement: these are SVG nodes, which do not
// carry the HTML-only `hidden` property — toggleAttribute works on both.
const timerTogglePath = document.getElementById(
  "timer-toggle-path",
) as unknown as Element;
const switchButton = document.getElementById(
  "switch-button",
) as HTMLButtonElement;
const idleBanner = document.getElementById("idle-banner")!;
const idleBannerMessage = document.getElementById("idle-banner-message")!;
const idleKeepButton = document.getElementById(
  "idle-keep-button",
) as HTMLButtonElement;
const idleDiscardButton = document.getElementById(
  "idle-discard-button",
) as HTMLButtonElement;
const idleNotice = document.getElementById("idle-notice")!;
const screenRecordingBanner = document.getElementById(
  "screen-recording-banner",
)!;
const screenRecordingBannerMessage = document.getElementById(
  "screen-recording-banner-message",
)!;
const screenRecordingGrantButton = document.getElementById(
  "screen-recording-grant-button",
) as HTMLButtonElement;
const screenRecordingSettingsButton = document.getElementById(
  "screen-recording-settings-button",
) as HTMLButtonElement;
const trackingIndicator = document.getElementById("tracking-indicator")!;

// --- Passive disclosure notice (see docs/adr/0015-...) ------------------
//
// Purely informational: it never blocks login, timer start, or capture.
// Shown as a persistent banner alongside the normal tracking view whenever
// the org has a current disclosure notice this device hasn't acknowledged
// yet, and refreshed on the same cadence as everything else in
// startPolling — there's no separate gate or full-screen view for it.

const disclosureBannerEl = document.getElementById("disclosure-banner")!;
const disclosureTextEl = document.getElementById("disclosure-text")!;
const disclosureErrorEl = document.getElementById("disclosure-error")!;
const disclosureAcknowledgeButton = document.getElementById(
  "disclosure-acknowledge-button",
) as HTMLButtonElement;

/** The version the currently-displayed banner text belongs to — submitted back verbatim on acknowledge. */
let pendingDisclosureVersionId: string | null = null;

async function refreshDisclosureBanner(): Promise<void> {
  const result = await window.api.consent.get();
  if (!result.ok || !result.data.required || !result.data.text) {
    disclosureBannerEl.hidden = true;
    pendingDisclosureVersionId = null;
    return;
  }

  pendingDisclosureVersionId = result.data.disclosureVersionId;
  disclosureTextEl.textContent = result.data.text;
  disclosureErrorEl.hidden = true;
  disclosureAcknowledgeButton.disabled = false;
  disclosureBannerEl.hidden = false;
}

disclosureAcknowledgeButton.addEventListener("click", () => {
  void (async () => {
    if (!pendingDisclosureVersionId) return;
    disclosureAcknowledgeButton.disabled = true;
    disclosureErrorEl.hidden = true;

    const result = await window.api.consent.submit(
      pendingDisclosureVersionId,
      "granted",
    );
    if (!result.ok) {
      disclosureErrorEl.textContent = result.message;
      disclosureErrorEl.hidden = false;
      disclosureAcknowledgeButton.disabled = false;
      return;
    }
    disclosureBannerEl.hidden = true;
  })();
});

/** Drives the "Tracking is on" banner — intent-based, not tied to whether a sample actually uploaded (see docs/adr/0015-...). */
async function refreshTrackingIndicator(): Promise<void> {
  const status = await window.api.tracking.indicatorStatus();
  trackingIndicator.hidden = !status.active;
}

let pollHandle: ReturnType<typeof setInterval> | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let idlePollHandle: ReturnType<typeof setInterval> | null = null;
let screenRecordingPollHandle: ReturnType<typeof setInterval> | null = null;
let runningEntry: TimeEntry | null = null;
// Server clock minus local clock, at the moment of the last successful
// poll — lets the 1s tick compute elapsed time from the server's own
// notion of "now" instead of trusting this device's clock.
let serverOffsetMs = 0;
let pendingSwitch: { projectId: string; taskId: string | null } | null = null;
let projects: TrackedProject[] = [];
/**
 * Seconds already recorded against each Project TODAY, from entries that
 * have ended. Switching Projects necessarily ends the previous entry — only
 * one may be open at a time — so without this the timer would read zero
 * every time someone returned to a Project they had already worked on.
 * Excludes the running entry, whose time is added live by `tick()`.
 */
let todaySecondsByProject = new Map<string, number>();
// Phosphor Play/Pause (regular), the same glyphs the web console uses.
const PLAY_PATH =
  "M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z";
const PAUSE_PATH =
  "M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z";

/** Per-Project total elements, so the 1s tick updates text instead of rebuilding rows. */
const projectTotalElements = new Map<string, HTMLElement>();

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

/**
 * Runs a tracking call and returns to the login view if the device session
 * has been revoked. `unauthorized` is a real 401, not a transient failure,
 * so a remote sign-out takes effect here rather than showing an inline
 * error the person has to act on.
 */
async function callTracking<T>(
  fn: () => Promise<TrackingResult<T>>,
): Promise<TrackingResult<T>> {
  const result = await fn();
  if (!result.ok && result.unauthorized) {
    showLoginView("You've been signed out — please log in to continue.");
  }
  return result;
}

function handleTrackingFailure(result: {
  message: string;
  unauthorized?: boolean;
}): void {
  if (result.unauthorized) {
    showLoginView(result.message);
    return;
  }
  showTrackingError(result.message);
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
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function tick(): void {
  if (!runningEntry) {
    timerDisplay.hidden = true;
    return;
  }

  // Shows the Project's whole day, not just this entry: switching away and
  // back ends one entry and opens another, and the person tracking time
  // thinks of that as one continuous total, not two.
  const seconds = displayedSecondsFor(runningEntry.projectId);
  timerDisplay.hidden = false;
  timerDisplay.textContent = formatElapsed(seconds * 1000);

  const activeTotal = projectTotalElements.get(runningEntry.projectId);
  if (activeTotal) activeTotal.textContent = formatElapsed(seconds * 1000);
}

function setRunning(entry: TimeEntry | null): void {
  // "Accumulating", not just "an entry exists": a paused entry is still
  // non-null (endedAt stays null so the one-running-timer rule holds), so
  // keying on null-ness alone let capture accrue straight through a pause.
  const wasAccumulating =
    runningEntry !== null && runningEntry.pausedAt == null;
  runningEntry = entry;
  const isPaused = entry?.pausedAt != null;
  const isRunning = entry !== null && !isPaused;
  // One control, two faces: pause while running, play otherwise. One path
  // re-pointed, the same swap the project rows use.
  timerTogglePath.setAttribute("d", isRunning ? PAUSE_PATH : PLAY_PATH);
  timerToggle.setAttribute(
    "aria-label",
    isRunning ? "Pause timer" : entry ? "Resume timer" : "Start timer",
  );
  renderProjects();
  if (!entry) {
    idleHandled = false;
    lastIdleSeconds = 0;
    hideIdleBanner();
  }
  // The only place "is time being tracked" changes — mirrored to main so
  // the session engine can gate on it. Pausing closes the open URL session.
  if (wasAccumulating !== isRunning) {
    window.api.urlCapture.timerStateChanged(isRunning);
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
  // A manual pause is the person explicitly saying "not tracking right
  // now" — idle detection re-flagging or auto-subtracting on top of that
  // would just be fighting their own choice.
  if (
    !runningEntry ||
    runningEntry.pausedAt ||
    !idlePolicy ||
    idlePolicy.handling === "off"
  ) {
    return;
  }

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

  if (idlePolicy.handling === "auto_subtract") {
    const result = await callTracking(() =>
      window.api.tracking.stop(idleStartedAtIso),
    );
    if (result.ok) {
      setRunning(null);
      showIdleNotice(
        `Timer stopped automatically after ${idleMinutes} min idle.`,
      );
    }
    return;
  }

  showIdleBanner(idleMinutes, idleStartedAtIso);
}

/** Seconds already tracked against a Project today, plus the live entry if it is that Project's. */
function displayedSecondsFor(projectId: string): number {
  const recorded = todaySecondsByProject.get(projectId) ?? 0;
  if (!runningEntry || runningEntry.projectId !== projectId) return recorded;
  return recorded + Math.max(0, Math.floor(liveElapsedMs() / 1000));
}

/**
 * Elapsed time of the CURRENT entry only. Frozen at the pause instant while
 * paused, so a paused timer stops climbing without losing what it had.
 */
function liveElapsedMs(): number {
  if (!runningEntry) return 0;
  const startedAtMs = new Date(runningEntry.startedAt).getTime();
  const pausedMs = runningEntry.pausedSeconds * 1000;
  return runningEntry.pausedAt
    ? new Date(runningEntry.pausedAt).getTime() - startedAtMs - pausedMs
    : Date.now() + serverOffsetMs - startedAtMs - pausedMs;
}

/** Re-reads today's per-Project totals from completed entries. */
async function refreshTodayTotals(): Promise<void> {
  const from = new Date(startOfToday()).toISOString();
  const to = new Date().toISOString();
  const result = await window.api.tracking.entriesBetween(from, to);
  if (!result.ok) return; // transient — keep whatever totals we already had

  const totals = new Map<string, number>();
  for (const entry of result.data) {
    // A null duration is the still-running entry; tick() adds its time
    // live, so counting it here too would double it.
    if (entry.durationSeconds === null) continue;
    totals.set(
      entry.projectId,
      (totals.get(entry.projectId) ?? 0) + entry.durationSeconds,
    );
  }
  todaySecondsByProject = totals;
}

/**
 * Renders one row per Project, each showing today's tracked total and
 * whether the timer is currently on it. Clicking a row moves the timer
 * there: the previous Project's entry is ended (its time is kept, and
 * shown in its row) and a new entry opens for the chosen one — the closest
 * thing to "pause the other project" the single-open-entry rule allows.
 */
function renderProjects(): void {
  projectList.innerHTML = "";
  projectTotalElements.clear();

  for (const project of projects) {
    const isActive = runningEntry?.projectId === project.id;
    // Only the project actually accruing time counts as running — the
    // active-but-paused one still offers play, because that is what
    // clicking it does.
    const isRunningHere = isActive && runningEntry?.pausedAt == null;

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-current", String(isActive));
    button.classList.toggle("is-running", isRunningHere);

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 256 256");
    icon.setAttribute("width", "32");
    icon.setAttribute("height", "32");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("class", "project-play");
    const iconPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    // The icon states what the click will do: pause the one that is
    // running, play anything else.
    iconPath.setAttribute("d", isRunningHere ? PAUSE_PATH : PLAY_PATH);
    iconPath.setAttribute("fill", "currentColor");
    icon.appendChild(iconPath);

    const label = document.createElement("span");
    label.className = "project-name";
    label.textContent = project.client
      ? `${project.name} (${project.client})`
      : project.name;

    const total = document.createElement("span");
    total.className = "project-total";
    total.textContent = formatElapsed(displayedSecondsFor(project.id) * 1000);

    projectTotalElements.set(project.id, total);
    button.append(icon, label, total);
    button.addEventListener("click", () => void selectProject(project.id));

    const item = document.createElement("li");
    item.appendChild(button);
    projectList.appendChild(item);
  }
}

/**
 * Moves the timer onto a Project. Switching while something is running uses
 * the atomic switch (one stop-then-start in a single transaction) so no
 * moment is double-counted or lost between the two.
 */
async function selectProject(projectId: string): Promise<void> {
  clearTrackingError();

  // Clicking the row that is currently running pauses it — the row shows a
  // pause icon, so doing nothing would make that icon a lie.
  if (runningEntry?.projectId === projectId && !runningEntry.pausedAt) {
    const paused = await window.api.tracking.pause();
    if (paused.ok) setRunning(paused.data);
    else handleTrackingFailure(paused);
    return;
  }

  await loadTasks(projectId);
  const taskId = taskSelect.value || null;

  const result = runningEntry
    ? await window.api.tracking.switchTo(projectId, taskId)
    : await window.api.tracking.start(projectId, taskId);

  if (!result.ok) {
    handleTrackingFailure(result);
    return;
  }
  // The previous entry just ended, so its time moved from "live" into the
  // recorded totals — re-read before rendering or its row briefly shows 0.
  await refreshTodayTotals();
  setRunning(result.data);
}

// --- Window-tracking permission banner ----------------------------------

async function refreshCapturePermissionBanner(): Promise<CapturePermissionStatus | null> {
  const result = await window.api.tracking.permissionStatus();
  if (!result.ok) return null;
  const status = result.data;

  // On macOS, window titles and screenshots are gated by the same Screen
  // Recording permission (see docs/adr/0011-..., docs/adr/0012-...), so the
  // banner there covers either capture feature being on. On Linux/Wayland,
  // only screenshots need a grant (the portal call in screenshot-portal.ts)
  // — window tracking already works there via AT-SPI2 (docs/adr/0016-...)
  // with no permission step of its own.
  const isMacCaptureGate =
    status.platform === "macos" &&
    (status.windowTrackingEnabled || status.screenshotsEnabled);
  const isWaylandScreenshotGate =
    status.platform === "linux" &&
    status.waylandUnsupported &&
    status.screenshotsEnabled;
  screenRecordingBanner.hidden = !(
    (isMacCaptureGate || isWaylandScreenshotGate) &&
    !status.screenRecordingGranted
  );
  screenRecordingBannerMessage.textContent = isWaylandScreenshotGate
    ? "Screenshots are off — needs a one-time screen access grant."
    : "Window title tracking is off — needs Screen Recording access.";
  // No Linux equivalent of macOS's Screen Recording settings pane to open.
  screenRecordingSettingsButton.hidden = status.platform !== "macos";

  return status;
}

function stopScreenRecordingGrantPolling(): void {
  if (screenRecordingPollHandle) clearInterval(screenRecordingPollHandle);
  screenRecordingPollHandle = null;
}

screenRecordingGrantButton.addEventListener("click", () => {
  void window.api.tracking.requestScreenRecordingAccess().then(() => {
    // macOS won't re-show its native prompt on repeat calls, so grant
    // detection has to be polled rather than awaited — stop as soon as
    // access is detected, or after a bounded timeout either way.
    stopScreenRecordingGrantPolling();
    const deadline = Date.now() + SCREEN_RECORDING_POLL_TIMEOUT_MS;
    screenRecordingPollHandle = setInterval(() => {
      void (async () => {
        const status = await refreshCapturePermissionBanner();
        if (status?.screenRecordingGranted || Date.now() > deadline) {
          stopScreenRecordingGrantPolling();
        }
      })();
    }, SCREEN_RECORDING_POLL_INTERVAL_MS);
  });
});

screenRecordingSettingsButton.addEventListener("click", () => {
  void window.api.tracking.openScreenRecordingSettings();
});

/** Returns false when the session turned out to be signed out — callers chaining further tracking setup should stop rather than continue. */
async function loadProjects(): Promise<boolean> {
  const result = await window.api.tracking.listProjects();
  if (!result.ok) {
    handleTrackingFailure(result);
    return !result.unauthorized;
  }

  projects = result.data;
  await refreshTodayTotals();
  renderProjects();

  if (projects.length > 0) {
    await loadTasks(projects[0].id);
  }
  return true;
}

async function loadTasks(projectId: string): Promise<void> {
  const result = await callTracking(() =>
    window.api.tracking.listTasks(projectId),
  );
  taskSelect.innerHTML = '<option value="">No task</option>';
  if (!result.ok) {
    handleTrackingFailure(result);
    return;
  }

  for (const task of result.data.tasks) {
    if (task.status === "closed") continue;
    const option = document.createElement("option");
    option.value = task.id;
    option.textContent = task.name;
    taskSelect.appendChild(option);
  }
}

/** Local midnight that starts the current calendar day, in the machine's own timezone. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Keeps the visible timer to today only. An entry started before midnight
 * is switched to a fresh one if still running, or closed at the instant it
 * was paused — never at "now", which would bill the intervening hours.
 *
 * Returns true when it acted, so the caller skips the stale entry.
 */
async function reconcileDayBoundary(entry: TimeEntry): Promise<boolean> {
  if (new Date(entry.startedAt).getTime() >= startOfToday()) return false;

  if (entry.pausedAt) {
    const result = await window.api.tracking.stop(entry.pausedAt);
    if (result.ok) setRunning(null);
    return result.ok;
  }

  const result = await window.api.tracking.switchTo(
    entry.projectId,
    entry.taskId,
  );
  if (result.ok) setRunning(result.data);
  return result.ok;
}

async function refreshStatus(): Promise<void> {
  const result = await callTracking(() => window.api.tracking.status());
  if (!result.ok) {
    if (result.unauthorized) {
      // Not a transient/offline blip — the backend has actually revoked
      // this session (e.g. an admin's remote sign-out). Every future poll
      // would fail identically, so switch to the login screen right away
      // instead of silently retrying forever.
      showLoginView(result.message);
      return;
    }
    // A genuinely transient/offline failure shouldn't wipe the
    // currently-displayed timer — just skip this poll and try again next
    // interval.
    return;
  }
  serverOffsetMs = new Date(result.data.now).getTime() - Date.now();

  const entry = result.data.entry;
  if (entry && (await reconcileDayBoundary(entry))) {
    return; // reconcile already applied the correct state
  }
  // Re-read recorded totals on the same 15s cadence: an entry may have been
  // ended elsewhere (the web console, a midnight split) and its time needs
  // to move into the per-Project rows.
  await refreshTodayTotals();
  setRunning(entry);
}

function startPolling(): void {
  stopPolling();
  void refreshStatus();
  pollHandle = setInterval(() => {
    void refreshStatus();
    void refreshCapturePermissionBanner();
    void refreshDisclosureBanner();
    void refreshTrackingIndicator();
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
  stopScreenRecordingGrantPolling();
}

/**
 * Resolves which Project a start should track against, so neither
 * auto-start nor the play icon ever has to prompt:
 *   1. whatever the timer last ran against, if it is still available, else
 *   2. the first Project in the list.
 * Returns null only when the account has no Projects at all.
 */
async function resolveProjectToTrack(): Promise<{
  projectId: string;
  taskId: string | null;
} | null> {
  if (projects.length === 0) return null;

  const remembered = await window.api.tracking.lastProject();
  if (
    remembered &&
    projects.some((project) => project.id === remembered.projectId)
  ) {
    return remembered;
  }
  return { projectId: projects[0].id, taskId: null };
}

/** Starts a new entry against the resolved Project. Shared by auto-start and play. */
async function startTracking(): Promise<void> {
  clearTrackingError();
  const target = await resolveProjectToTrack();
  if (!target) {
    showTrackingError("No projects are available to track time against.");
    return;
  }

  await loadTasks(target.projectId);
  if (target.taskId) taskSelect.value = target.taskId;

  const result = await window.api.tracking.start(
    target.projectId,
    target.taskId,
  );
  if (result.ok) {
    setRunning(result.data);
    return;
  }

  handleTrackingFailure(result);
  if (result.runningEntry && !result.unauthorized) {
    pendingSwitch = { projectId: target.projectId, taskId: target.taskId };
    switchButton.hidden = false;
  }
}

timerToggle.addEventListener("click", () => {
  void (async () => {
    timerToggle.disabled = true;
    try {
      if (!runningEntry) {
        await startTracking();
        return;
      }

      clearTrackingError();
      const result = runningEntry.pausedAt
        ? await window.api.tracking.resume()
        : await window.api.tracking.pause();
      if (result.ok) {
        setRunning(result.data);
      } else {
        handleTrackingFailure(result);
      }
    } finally {
      timerToggle.disabled = false;
    }
  })();
});

switchButton.addEventListener("click", () => {
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
      handleTrackingFailure(result);
    }
  })();
});

idleKeepButton.addEventListener("click", () => {
  hideIdleBanner();
});

idleDiscardButton.addEventListener("click", () => {
  void (async () => {
    if (!pendingIdleDiscardAt) return;
    const discardAt = pendingIdleDiscardAt;
    hideIdleBanner();

    const result = await callTracking(() =>
      window.api.tracking.stop(discardAt),
    );
    if (result.ok) {
      setRunning(null);
    } else {
      handleTrackingFailure(result);
    }
  })();
});

async function initTracking(): Promise<void> {
  clearTrackingError();
  const stillSignedIn = await loadProjects();
  if (!stillSignedIn) return; // loadProjects already switched to the login screen

  const idlePolicyResult = await callTracking(() =>
    window.api.tracking.idlePolicy(),
  );
  idlePolicy = idlePolicyResult.ok ? idlePolicyResult.data : null;

  // Settle the server's view before deciding whether to auto-start, so an
  // already-running or paused entry is respected rather than met with a
  // duplicate start the backend would 409. Ahead of startPolling() so the
  // decision isn't racing its first refresh.
  await refreshStatus();

  // Signing in is itself the intent to track, so no click is required.
  // Only fires when nothing is tracked yet — a paused entry stays paused.
  if (!runningEntry) {
    await startTracking();
  }

  void refreshCapturePermissionBanner();
  void refreshTrackingIndicator();
  startPolling();
}

void init();
