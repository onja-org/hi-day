export {};

const STATUS_POLL_INTERVAL_MS = 15_000;
/**
 * How often the day's totals are reconciled against the server, to catch
 * time added elsewhere. Below the status poll, so in practice every poll
 * reconciles and added time lands within one.
 */
const TODAY_MERGE_INTERVAL_MS = 5_000;
const IDLE_POLL_INTERVAL_MS = 10_000;
const IDLE_POLICY_REFRESH_MS = 60_000;
const PAIRING_POLL_INTERVAL_MS = 3_000;
const PAIRING_POLL_MAX_ATTEMPTS = 210;
const DEFAULT_PAIRING_MESSAGE =
  "Sign in from your browser to link this device.";
const SCREEN_RECORDING_POLL_INTERVAL_MS = 2_500;
const SCREEN_RECORDING_POLL_TIMEOUT_MS = 30_000;

function show(viewId: string): void {
  for (const el of document.querySelectorAll<HTMLElement>(
    "#setup-view, #loading-view, #login-view, #status-view",
  )) {
    el.hidden = el.id !== viewId;
  }
  // The account menu and the compact bar only mean something signed in.
  document.getElementById("profile")!.hidden = viewId !== "status-view";
  if (viewId !== "status-view") setCompact(false);
}

// --- Window chrome: frameless title bar and the compact bar -------------

const fullView = document.getElementById("full-view")!;
const compactView = document.getElementById("compact-view")!;
const miniView = document.getElementById("mini-view")!;

type WindowMode = "full" | "compact" | "mini";
let windowMode: WindowMode = "full";

function setMode(mode: WindowMode, centre = false): void {
  if (mode === windowMode) return;
  windowMode = mode;
  fullView.hidden = mode !== "full";
  compactView.hidden = mode !== "compact";
  miniView.hidden = mode !== "mini";
  document.body.classList.toggle("is-mini", mode === "mini");
  void window.api.windowControls.setMode(mode, centre);
}

function setCompact(compact: boolean): void {
  setMode(compact ? "compact" : "full");
}

document.getElementById("minimise-button")!.addEventListener("click", () => {
  void window.api.windowControls.minimise();
});
document.getElementById("close-button")!.addEventListener("click", () => {
  void window.api.windowControls.close();
});

// --- Close prompt: minimise to the tray, or quit ------------------------

const closePrompt = document.getElementById("close-prompt")!;
const closePromptRemember = document.getElementById(
  "close-prompt-remember",
) as HTMLInputElement;
const closePromptMinimise = document.getElementById(
  "close-prompt-minimise",
) as HTMLButtonElement;

function answerClose(action: "minimize" | "quit" | null): void {
  closePrompt.hidden = true;
  void window.api.windowControls.answerClose(
    action,
    action !== null && closePromptRemember.checked,
  );
}

window.api.windowControls.onCloseRequested(() => {
  if (!closePrompt.hidden) return; // already asking
  // The compact bar is too short to hold the prompt.
  setCompact(false);
  closePromptRemember.checked = false;
  closePrompt.hidden = false;
  closePromptMinimise.focus();
});
closePromptMinimise.addEventListener("click", () => answerClose("minimize"));
document
  .getElementById("close-prompt-quit")!
  .addEventListener("click", () => answerClose("quit"));
document
  .getElementById("close-prompt-cancel")!
  .addEventListener("click", () => answerClose(null));
closePrompt.addEventListener("click", (event) => {
  if (event.target === closePrompt) answerClose(null); // backdrop
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !closePrompt.hidden) answerClose(null);
});
document.getElementById("compact-button")!.addEventListener("click", () => {
  setCompact(true);
});
document.getElementById("expand-button")!.addEventListener("click", () => {
  setCompact(false);
});

document.getElementById("compact-shrink")!.addEventListener("click", () => {
  setMode("mini");
});
document.getElementById("mini-expand")!.addEventListener("click", () => {
  setMode("compact");
});

const compactPin = document.getElementById("compact-pin")!;

function showPinState(pinned: boolean): void {
  compactPin.setAttribute("aria-pressed", String(pinned));
  compactPin.classList.toggle("is-on", pinned);
  compactPin.title = pinned ? "Keep in front: on" : "Keep in front: off";
}

void window.api.windowControls.compactAlwaysOnTop().then(showPinState);

compactPin.addEventListener("click", () => {
  const pinned = compactPin.getAttribute("aria-pressed") !== "true";
  showPinState(pinned);
  void window.api.windowControls.setCompactAlwaysOnTop(pinned);
});

const userAvatar = document.getElementById("user-avatar") as HTMLButtonElement;
const profileMenu = document.getElementById("profile-menu")!;
const profileSignedInAsEl = document.getElementById("profile-signed-in-as")!;
const profileEmailEl = document.getElementById("profile-email")!;

function hideProfileMenu(): void {
  profileMenu.hidden = true;
  userAvatar.setAttribute("aria-expanded", "false");
}

userAvatar.addEventListener("click", () => {
  const willShow = profileMenu.hidden;
  profileMenu.hidden = !willShow;
  userAvatar.setAttribute("aria-expanded", String(willShow));
});

document.addEventListener("click", (event) => {
  if (profileMenu.hidden) return;
  if (
    event.target instanceof Node &&
    (userAvatar.contains(event.target) || profileMenu.contains(event.target))
  ) {
    return;
  }
  hideProfileMenu();
});

function showLoggedIn(
  organisationName: string,
  email?: string,
  name?: string,
): void {
  document.getElementById("organisation-name")!.textContent = organisationName;
  userAvatar.textContent = email ? email.trim().charAt(0).toUpperCase() : "";
  profileSignedInAsEl.textContent = `Signed in as ${name ?? email ?? ""}`;
  profileEmailEl.textContent = email ?? "";
  // First name only — "Hi, Rinon." — falling back when the account has no name.
  const firstName = name?.trim().split(/\s+/)[0];
  greetingEl.textContent = firstName ? `Hi, ${firstName}.` : "Hi there.";
  hideProfileMenu();

  show("status-view");
  void initTracking();
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
  projectsLoaded = false;
  idlePolicy = null;
  lastTrackedProjectId = null;
  pendingTaskChoice = null;
  // Stops the clock, tells main to stop url-capture, and clears the row
  // highlight — otherwise the timer keeps counting behind the login screen.
  setRunning(null);
  // After the stop, which folds the live entry into the totals.
  todaySecondsByProject = new Map();
  clearTrackingError();
  timerDisplay.hidden = true;
  projectSearch.value = "";
  lastSyncedAt = null;
  syncFailing = false;
  hideProfileMenu();

  pairingErrorEl.hidden = !errorMessage;
  pairingErrorEl.textContent = errorMessage ?? "";
  pairingStatusEl.textContent = DEFAULT_PAIRING_MESSAGE;
  loginButton.disabled = false;
  loginButton.textContent = "Log in";
  show("login-view");
  stopPolling();
  stopPairingPoll();
  cancelTrackingRetry();
}

const AUTO_UPDATE_POLL_INTERVAL_MS = 10_000;

const updateBannerEl = document.getElementById("update-banner")!;
const updateMessageEl = document.getElementById("update-message")!;
const updateButtonEl = document.getElementById(
  "update-button",
) as HTMLButtonElement;

let updateButtonMode: "view" | "restart" = "view";
let currentUpdateKey: string | null = null;
let updateDismissedForKey: string | null = null;

function showUpdateBanner(
  message: string,
  buttonMode: "view" | "restart",
  key: string,
): void {
  currentUpdateKey = key;
  if (updateDismissedForKey === key) return;
  updateMessageEl.textContent = message;
  updateButtonMode = buttonMode;
  updateButtonEl.hidden = false;
  updateButtonEl.textContent =
    buttonMode === "restart" ? "Restart now" : "View update";
  updateBannerEl.hidden = false;
}

/** The manual fallback: unsigned macOS, a non-AppImage Linux install, or a transient auto-update failure all land here. */
async function checkForUpdate(): Promise<void> {
  const result = await window.api.update.status();
  if (!result.updateAvailable) {
    updateBannerEl.hidden = true;
    return;
  }

  showUpdateBanner(
    result.latestVersion
      ? `Version ${result.latestVersion} is available.`
      : "A new version is available.",
    "view",
    `manual:${result.latestVersion ?? ""}`,
  );
}

async function refreshUpdateBanner(): Promise<void> {
  const auto = await window.api.update.autoStatus();

  if (auto.phase === "downloading") {
    const progress =
      auto.progressPercent !== undefined ? ` (${auto.progressPercent}%)` : "";
    showUpdateBanner(
      auto.latestVersion
        ? `Downloading version ${auto.latestVersion}${progress}…`
        : `Downloading update${progress}…`,
      "view",
      `downloading:${auto.latestVersion ?? ""}`,
    );
    updateButtonEl.hidden = true; // nothing to click while it's still in flight
    return;
  }

  if (auto.phase === "downloaded") {
    showUpdateBanner(
      auto.latestVersion
        ? `Version ${auto.latestVersion} downloaded — restart to apply.`
        : "Update downloaded — restart to apply.",
      "restart",
      `downloaded:${auto.latestVersion ?? ""}`,
    );
    return;
  }

  // idle/checking/unsupported — nothing silent is happening, so fall back
  // to the manual GitHub check every platform has always had.
  await checkForUpdate();
}

updateButtonEl.addEventListener("click", () => {
  if (updateButtonMode === "restart") {
    void window.api.update.restart();
    return;
  }
  void window.api.update.openReleasesPage();
});

document.getElementById("update-dismiss")!.addEventListener("click", () => {
  updateBannerEl.hidden = true;
  updateDismissedForKey = currentUpdateKey;
});

const setupMessage = document.getElementById("setup-message")!;
const setupManual = document.getElementById("setup-manual")!;
const setupWarning = document.getElementById("setup-warning")!;
const setupContinueButton = document.getElementById(
  "setup-continue-button",
) as HTMLButtonElement;

/** "Chrome", "Chrome and Firefox", "Chrome, Edge and Firefox". */
function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * A browser open before the agent wrote its launcher overrides needs
 * restarting for two reasons: it has no accessibility tree, so its URLs go
 * unrecorded; and the desktop lost the link between its windows and its
 * launcher when the override replaced the entry underneath them, so its dock
 * icon stops showing it as running and clicking that icon opens a new window
 * instead of raising the open one. The second outlasts the first — it applies
 * even to a browser that was already tracked — which is why the screen says
 * so rather than leaving it to be discovered.
 *
 * Asked once, before the login view, and never again on this install — the
 * main process decides that, since it owns the record. Returns false when
 * there was nothing to ask, so the caller carries on to the normal views.
 */
async function showBrowserRestartSetup(): Promise<boolean> {
  let prompt: BrowserRestartPrompt;
  try {
    prompt = await window.api.setup.browserRestartPrompt();
  } catch {
    return false;
  }
  if (!prompt.show) return false;

  const manualNames = prompt.manual.map((entry) => entry.name);
  const named = [...prompt.names, ...manualNames];
  setupMessage.textContent =
    `${listOf(named)} ${named.length > 1 ? "need" : "needs"} restarting once ` +
    `before website tracking can start.` +
    // Only promised for the ones Continue can actually relaunch.
    (prompt.names.length > 0
      ? ` Continue restarts ${prompt.names.length > 1 ? "them" : "it"} — save ` +
        `anything unsaved first.`
      : "");

  // Said plainly rather than left to the person to notice: the button above
  // will not touch these, so the screen has to say who does.
  setupManual.textContent =
    manualNames.length > 0
      ? `${listOf(manualNames)} ${manualNames.length > 1 ? "need" : "needs"} ` +
        `restarting by hand — Continue cannot do ${manualNames.length > 1 ? "those" : "that"} one.`
      : "";
  setupManual.hidden = manualNames.length === 0;

  // One line only: a sentence per browser turned this into a wall of text.
  setupWarning.textContent = prompt.warnings[0] ?? "";
  setupWarning.hidden = prompt.warnings.length === 0;

  show("setup-view");
  return true;
}

function startApp(): void {
  void refreshUpdateBanner();
  setInterval(() => void refreshUpdateBanner(), AUTO_UPDATE_POLL_INTERVAL_MS);

  void window.api
    .getStatus()
    .then((status) => {
      if (status.loggedIn && status.organisationName) {
        showLoggedIn(status.organisationName, status.email, status.name);
      } else {
        showLoginView();
      }
    })

    .catch(() => showLoginView("Could not read this device's session."));
}

setupContinueButton.addEventListener("click", () => {
  void window.api.setup.continueFromBrowserRestart();
  startApp();
});

async function init(): Promise<void> {
  if (await showBrowserRestartSetup()) return;
  startApp();
}

async function pollPairing(): Promise<void> {
  pairingPollAttempts += 1;
  const result = await window.api.auth.pairingStatus();

  if (result.status === "approved") {
    stopPairingPoll();
    showLoggedIn(result.organisationName, result.email, result.name);
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
const projectListEmpty = document.getElementById("project-list-empty")!;
const projectCountEl = document.getElementById("project-count")!;
const projectSearch = document.getElementById(
  "project-search",
) as HTMLInputElement;
const greetingEl = document.getElementById("greeting")!;
const timerCard = document.getElementById("timer-card")!;
const timerStateEl = document.getElementById("timer-state")!;
const timerStateLabelEl = document.getElementById("timer-state-label")!;
const syncStatusEl = document.getElementById("sync-status")!;
const syncStatusLabelEl = document.getElementById("sync-status-label")!;
const compactProjectNameEl = document.getElementById("compact-project-name")!;
const compactTimerEl = document.getElementById("compact-timer")!;
const compactTimerToggle = document.getElementById(
  "compact-timer-toggle",
) as HTMLButtonElement;
const compactTimerTogglePath = document.getElementById(
  "compact-timer-toggle-path",
) as unknown as Element;
const miniTimerEl = document.getElementById("mini-timer")!;
const miniTimerToggle = document.getElementById(
  "mini-timer-toggle",
) as HTMLButtonElement;
const miniTimerTogglePath = document.getElementById(
  "mini-timer-toggle-path",
) as unknown as Element;
const currentTaskLabelEl = document.getElementById("current-task-label")!;
const timerDisplay = document.getElementById("timer-display")!;
const trackingError = document.getElementById("tracking-error")!;
const trackingNotice = document.getElementById("tracking-notice")!;
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
const reminderBanner = document.getElementById("reminder-banner")!;
const reminderBannerMessage = document.getElementById(
  "reminder-banner-message",
)!;
const reminderStartButton = document.getElementById("reminder-start-button")!;
const reminderDismissButton = document.getElementById(
  "reminder-dismiss-button",
)!;
const idleBannerMessage = document.getElementById("idle-banner-message")!;
const idleKeepButton = document.getElementById(
  "idle-keep-button",
) as HTMLButtonElement;
const idleDiscardButton = document.getElementById(
  "idle-discard-button",
) as HTMLButtonElement;
const idleDurationEl = document.getElementById("idle-duration")!;
const idleSinceEl = document.getElementById("idle-since")!;
const idleAssignToggle = document.getElementById(
  "idle-assign-toggle",
) as HTMLButtonElement;
const idleAssignList = document.getElementById(
  "idle-assign-list",
) as HTMLUListElement;
const idleNotice = document.getElementById("idle-notice")!;
const todayTotalEl = document.getElementById("today-total")!;
const trackingProjectNameEl = document.getElementById("tracking-project-name")!;
const taskTrigger = document.getElementById(
  "task-trigger",
) as HTMLButtonElement;
const taskPanel = document.getElementById("task-panel")!;
const taskPanelProject = document.getElementById("task-panel-project")!;
const taskPanelClose = document.getElementById(
  "task-panel-close",
) as HTMLButtonElement;
const taskSearch = document.getElementById("task-search") as HTMLInputElement;
const taskPanelList = document.getElementById(
  "task-panel-list",
) as HTMLUListElement;
const taskPanelEmpty = document.getElementById("task-panel-empty")!;
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
const accessibilityBanner = document.getElementById("accessibility-banner")!;
const accessibilityBannerMessage = document.getElementById(
  "accessibility-banner-message",
)!;
const accessibilitySettingsButton = document.getElementById(
  "accessibility-settings-button",
) as HTMLButtonElement;

let pollHandle: ReturnType<typeof setInterval> | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let idlePollHandle: ReturnType<typeof setInterval> | null = null;
let screenRecordingPollHandle: ReturnType<typeof setInterval> | null = null;
let runningEntry: TimeEntry | null = null;

let serverOffsetMs = 0;
/**
 * The running entry's worked time as of `accountWorkedMsAt`, counted on
 * this device's clock from there. Seeded from the server only when the app
 * opens or something changed elsewhere — see refreshStatus.
 */
let accountWorkedMs = 0;
let accountWorkedMsAt: number | null = null;
/** The account total frozen at the instant this device paused. */
let pausedAtWorkedMs = 0;
let pendingSwitch: { projectId: string; taskId: string | null } | null = null;
let projects: TrackedProject[] = [];
/** False until a project list has actually come back — an empty `projects` alone can't tell "none" from "not loaded". */
let projectsLoaded = false;

let todaySecondsByProject = new Map<string, number>();
/** The day `todaySecondsByProject` was read for, so a new day re-reads it. */
let todaySecondsDayStart: number | null = null;
/** Completed entries already folded into the totals, so a later read adds
 * only what is genuinely new. */
let countedEntryIds = new Set<string>();
/** The limit stop already shown, so a repeated report doesn't reopen it. */
let shownLimitKey: string | null = null;
/** When the totals were last reconciled against the server. */
let todaySecondsReconciledAt = 0;
let currentProjectTasks: TrackedTask[] = [];
let selectedTaskId: string | null = null;
// The Project `currentProjectTasks` was loaded for.
let tasksProjectId: string | null = null;
// A Task picked while stopped, which the next play starts on.
let pendingTaskChoice: { projectId: string; taskId: string | null } | null =
  null;
// 24×24 icons. "Stop" rather than pause: pausing ends the entry.
const PLAY_PATH =
  "M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z";
const STOP_PATH =
  "M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z";
/** A status poll older than this reads as minutes ago rather than "just now". */
const SYNC_FRESH_MS = 60_000;
let lastSyncedAt: number | null = null;
let syncFailing = false;

/** Per-Project total elements, so the 1s tick updates text instead of rebuilding rows. */
const projectTotalElements = new Map<string, HTMLElement>();

let idlePolicy: IdlePolicy | null = null;
let idlePolicyLoadedAt = 0;
let lastIdleSeconds = 0;
let idleHandled = false;
let pendingIdleDiscardAt: string | null = null;
// When input resumed while the idle prompt was still open — freezes "Idle for".
let idleEndedAtMs: number | null = null;

function showTrackingError(message: string): void {
  trackingError.textContent = message;
  trackingError.hidden = false;
  // The compact bar has no room for it — open the full window instead.
  setCompact(false);
}

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
  status?: number;
}): void {
  if (result.unauthorized) {
    showLoginView(result.message);
    return;
  }
  // 403 is the organisation refusing this — a work time limit, a day
  // tracking is off on, an app it doesn't allow. That is a rule, not a
  // fault, so it gets a dialog rather than the red line above the timer,
  // which was easy to miss while looking at the Play button.
  if (result.status === 403) {
    timerBlockedTitle.textContent = "Timer could not be started";
    showTimerBlocked(result.message);
    return;
  }
  showTrackingError(result.message);
}

const timerBlocked = document.getElementById("timer-blocked")!;
const timerBlockedMessage = document.getElementById("timer-blocked-message")!;
const timerBlockedDismiss = document.getElementById(
  "timer-blocked-dismiss",
) as HTMLButtonElement;

/**
 * A refusal to start — a work time limit reached, a day tracking is off
 * on — shown as a dialog rather than the red line above the timer. It is
 * a rule the organisation set, not a fault, and the inline text was easy
 * to miss while looking at the Play button.
 */
function showTimerBlocked(message: string): void {
  timerBlockedMessage.textContent = message;
  timerBlocked.hidden = false;
  timerBlockedDismiss.focus();
}

timerBlockedDismiss.addEventListener("click", () => {
  timerBlocked.hidden = true;
});

const timerBlockedTitle = document.getElementById("timer-blocked-title")!;

/**
 * The timer was ended for them, not by them, for reaching a daily or
 * weekly limit. Says so in the same dialog a refused start uses, and asks
 * the main process to raise the window — stopping silently behind other
 * windows is how someone keeps working untracked.
 */
function showTimerStoppedByLimit(limit: {
  kind: "daily" | "weekly";
  limitHours: number;
}): void {
  const period = limit.kind === "daily" ? "today" : "this week";
  const resets = limit.kind === "daily" ? "tomorrow" : "when the week resets";
  const body =
    `You have tracked the ${formatElapsed(limit.limitHours * 3600 * 1000)} ` +
    `your organisation allows ${period}, so your timer was stopped. The time ` +
    `you tracked is saved. You can track again ${resets}.`;

  timerBlockedTitle.textContent = "Your timer has stopped";
  showTimerBlocked(body);
  void window.api.trackingAlert(body);
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

/** "4:57" — hours and minutes, for the per-Project rows. */
function formatHoursMinutes(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/** Every Project's time today, the live entry included. */
function todayTotalSeconds(): number {
  const projectIds = new Set(todaySecondsByProject.keys());
  if (runningEntry) projectIds.add(runningEntry.projectId);
  let total = 0;
  for (const projectId of projectIds) total += displayedSecondsFor(projectId);
  return total;
}

function updateSyncStatus(): void {
  syncStatusEl.classList.toggle("is-offline", syncFailing);
  if (syncFailing) {
    syncStatusLabelEl.textContent = "Can't reach Hi Day — retrying";
    return;
  }
  if (lastSyncedAt === null) {
    syncStatusLabelEl.textContent = "Connecting…";
    return;
  }
  const ageMs = Date.now() - lastSyncedAt;
  syncStatusLabelEl.textContent =
    ageMs < SYNC_FRESH_MS
      ? "Synced just now"
      : `Synced ${Math.floor(ageMs / 60_000)} min ago`;
}

function projectNameFor(projectId: string): string {
  return (
    projects.find((project) => project.id === projectId)?.name ?? projectId
  );
}

// Lets a paused timer keep showing its project and frozen total.
let lastTrackedProjectId: string | null = null;

function tick(): void {
  todayTotalEl.textContent = formatElapsed(todayTotalSeconds() * 1000);
  updateSyncStatus();

  if (!runningEntry) {
    const projectId = lastTrackedProjectId;
    if (!projectId || !projects.some((project) => project.id === projectId)) {
      timerDisplay.hidden = true;
      trackingProjectNameEl.textContent = "";
      compactProjectNameEl.textContent = "Stopped";
      compactTimerEl.textContent = formatElapsed(0);
      miniTimerEl.textContent = formatElapsed(0);
      return;
    }
    const name = projectNameFor(projectId);
    const formatted = formatElapsed(displayedSecondsFor(projectId) * 1000);
    trackingProjectNameEl.textContent = name;
    timerDisplay.hidden = false;
    timerDisplay.textContent = formatted;
    compactProjectNameEl.textContent = `${name} · Stopped`;
    compactTimerEl.textContent = formatted;
    miniTimerEl.textContent = formatted;
    return;
  }

  const name = projectNameFor(runningEntry.projectId);
  trackingProjectNameEl.textContent = name;
  compactProjectNameEl.textContent = runningEntry.pausedAt
    ? `${name} · Paused`
    : name;

  // Shows the Project's whole day, not just this entry: switching away and
  // back ends one entry and opens another, and the person tracking time
  // thinks of that as one continuous total, not two.
  const seconds = displayedSecondsFor(runningEntry.projectId);
  const formatted = formatElapsed(seconds * 1000);
  timerDisplay.hidden = false;
  timerDisplay.textContent = formatted;
  compactTimerEl.textContent = formatted;
  miniTimerEl.textContent = formatted;

  const activeTotal = projectTotalElements.get(runningEntry.projectId);
  if (activeTotal) activeTotal.textContent = formatHoursMinutes(seconds);
}

// Lets an in-flight status poll detect that its snapshot is stale.
let runningStateVersion = 0;

function setRunning(entry: TimeEntry | null): void {
  runningStateVersion++;
  const previous = runningEntry;
  if ((entry?.id ?? null) !== (previous?.id ?? null)) {
    // The ended entry's time stays as this device counted it, so stopping
    // doesn't jump to whatever the server booked.
    if (previous) {
      todaySecondsByProject.set(
        previous.projectId,
        displayedSecondsFor(previous.projectId),
      );
      // Counted here, so the server's copy of this same entry is not
      // folded in again by `mergeNewTodayEntries`.
      countedEntryIds.add(previous.id);
    }
    // A new entry counts from now, not from the last poll's baseline — that
    // stale baseline is what made a restarted timer jump ahead, then back.
    accountWorkedMs = 0;
    accountWorkedMsAt = entry ? Date.now() : null;
    pausedAtWorkedMs = 0;
  } else if (entry && previous && entry.pausedAt && !previous.pausedAt) {
    pausedAtWorkedMs = liveElapsedMs();
  } else if (entry && previous && !entry.pausedAt && previous.pausedAt) {
    accountWorkedMs = pausedAtWorkedMs;
    accountWorkedMsAt = Date.now();
  }
  if (entry) lastTrackedProjectId = entry.projectId;
  // "Accumulating", not just "an entry exists": a paused entry is still
  // non-null (endedAt stays null so the one-running-timer rule holds), so
  // keying on null-ness alone let capture accrue straight through a pause.
  const wasAccumulating =
    runningEntry !== null && runningEntry.pausedAt == null;
  runningEntry = entry;
  const isPaused = entry?.pausedAt != null;
  const isRunning = entry !== null && !isPaused;
  // One control, two faces: stop while running, play otherwise. One path
  // re-pointed, mirrored on the compact bar.
  const toggleLabel = isRunning
    ? "Stop timer"
    : entry
      ? "Resume timer"
      : "Start timer";
  for (const [button, path] of [
    [timerToggle, timerTogglePath],
    [compactTimerToggle, compactTimerTogglePath],
    [miniTimerToggle, miniTimerTogglePath],
  ] as const) {
    path.setAttribute("d", isRunning ? STOP_PATH : PLAY_PATH);
    button.setAttribute("aria-label", toggleLabel);
    button.classList.toggle("is-running", isRunning);
  }
  timerCard.classList.toggle("is-running", isRunning);
  compactView.classList.toggle("is-running", isRunning);
  miniView.classList.toggle("is-running", isRunning);
  timerStateEl.hidden = isRunning;
  timerStateLabelEl.textContent = isPaused ? "Paused" : "Stopped";
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

/** Local HH:MM, on the machine's clock rather than the server's. */
function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateIdleStats(idleSeconds: number, idleStartedAtIso: string): void {
  idleDurationEl.textContent = formatElapsed(idleSeconds * 1000);
  idleSinceEl.textContent = formatClockTime(idleStartedAtIso);

  idleBannerMessage.textContent = "";
  idleBannerMessage.append(
    document.createTextNode("No keyboard or mouse activity while tracking "),
  );
  const projectNameStrong = document.createElement("strong");
  projectNameStrong.textContent = runningEntry
    ? projectNameFor(runningEntry.projectId)
    : "";
  idleBannerMessage.append(projectNameStrong);
  idleBannerMessage.append(
    document.createTextNode(
      ". The timer is still running — choose what to do with the idle time.",
    ),
  );
}

function showIdleBanner(idleSeconds: number, idleStartedAtIso: string): void {
  pendingIdleDiscardAt = idleStartedAtIso;
  updateIdleStats(idleSeconds, idleStartedAtIso);
  idleBanner.hidden = false;
  // Needs an answer, so it can't wait behind the compact bar or in the tray.
  setCompact(false);
  void window.api.windowControls.show();
}

function hideIdleBanner(): void {
  idleBanner.hidden = true;
  idleAssignList.hidden = true;
  pendingIdleDiscardAt = null;
  idleEndedAtMs = null;
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

  const inputResumed = idleSeconds < lastIdleSeconds;
  lastIdleSeconds = idleSeconds;

  if (!idleBanner.hidden) {
    // Stays open until answered, even after input resumes (like Hubstaff);
    // the timer keeps running meanwhile.
    if (inputResumed && idleEndedAtMs === null) {
      idleEndedAtMs = Date.now() + serverOffsetMs - idleSeconds * 1000;
    }
    if (pendingIdleDiscardAt) {
      const blockEndMs = idleEndedAtMs ?? Date.now() + serverOffsetMs;
      const blockSeconds = Math.floor(
        (blockEndMs - Date.parse(pendingIdleDiscardAt)) / 1000,
      );
      updateIdleStats(blockSeconds, pendingIdleDiscardAt);
    }
    return;
  }

  if (inputResumed) {
    // Real input happened since the last check.
    idleHandled = false;
  }

  if (idleSeconds < thresholdSeconds) return;

  const idleStartedAtIso = new Date(
    Date.now() + serverOffsetMs - idleSeconds * 1000,
  ).toISOString();

  if (idlePolicy.handling === "auto_subtract") {
    if (idleHandled) return;
    idleHandled = true;
    const result = await callTracking(() =>
      window.api.tracking.stop(idleStartedAtIso),
    );
    if (result.ok) {
      setRunning(null);
      showIdleNotice(
        `Timer stopped automatically after ${Math.floor(idleSeconds / 60)} min idle.`,
      );
    }
    return;
  }

  if (idleHandled) return;
  idleHandled = true;
  showIdleBanner(idleSeconds, idleStartedAtIso);
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

  if (runningEntry.pausedAt) return pausedAtWorkedMs;
  // setRunning sets this whenever an entry starts running.
  return accountWorkedMs + (Date.now() - (accountWorkedMsAt ?? Date.now()));
}

/** Re-reads today's per-Project totals from completed entries. */
async function refreshTodayTotals(): Promise<void> {
  const from = new Date(startOfToday()).toISOString();
  const to = new Date().toISOString();
  const result = await window.api.tracking.entriesBetween(from, to);
  if (!result.ok) return; // transient — keep whatever totals we already had

  const totals = new Map<string, number>();
  const counted = new Set<string>();
  for (const entry of result.data) {
    // A null duration is the still-running entry; tick() adds its time
    // live, so counting it here too would double it.
    if (entry.durationSeconds === null) continue;
    counted.add(entry.id);
    totals.set(
      entry.projectId,
      (totals.get(entry.projectId) ?? 0) + entry.durationSeconds,
    );
  }
  todaySecondsByProject = totals;
  todaySecondsDayStart = startOfToday();
  countedEntryIds = counted;
  todaySecondsReconciledAt = Date.now();
}

/**
 * Folds in completed entries this agent has not counted yet — time added
 * from the web console, or tracked on another machine. Deliberately
 * *additive*: replacing the totals would re-derive the baseline the live
 * tick counts up from, and any disagreement between the server's clock
 * and this one would show as the display jumping backwards.
 */
async function mergeNewTodayEntries(): Promise<void> {
  const result = await window.api.tracking.entriesBetween(
    new Date(startOfToday()).toISOString(),
    new Date().toISOString(),
  );
  if (!result.ok) return; // transient — try again on the next poll

  todaySecondsReconciledAt = Date.now();
  let added = false;
  for (const entry of result.data) {
    // The running entry belongs to the live tick, which counts it up from
    // this baseline — folding it in here too would count it twice. A
    // duration is not enough to tell: the server reports one for an entry
    // that is still open.
    if (entry.durationSeconds === null) continue;
    if (runningEntry && entry.id === runningEntry.id) continue;
    // Without an id there is no telling this apart from time already
    // counted, and adding it twice is worse than missing it.
    if (!entry.id) continue;
    if (countedEntryIds.has(entry.id)) continue;
    countedEntryIds.add(entry.id);
    todaySecondsByProject.set(
      entry.projectId,
      (todaySecondsByProject.get(entry.projectId) ?? 0) + entry.durationSeconds,
    );
    added = true;
  }
  if (added) {
    renderProjects();
    tick();
  }
}

function renderProjects(): void {
  projectList.innerHTML = "";
  projectTotalElements.clear();
  projectCountEl.textContent = String(projects.length);

  const query = projectSearch.value.trim().toLowerCase();
  const matches = projects.filter(
    (project) =>
      !query ||
      project.name.toLowerCase().includes(query) ||
      (project.client ?? "").toLowerCase().includes(query),
  );
  projectListEmpty.hidden = matches.length > 0 || projects.length === 0;

  for (const project of matches) {
    // Stays on the last-tracked Project after a stop, so it is one click
    // to pick back up.
    const isActive =
      (runningEntry?.projectId ?? lastTrackedProjectId) === project.id;
    // Only the project actually accruing time counts as running — the
    // active-but-paused one still offers play, because that is what
    // clicking it does.
    const isRunningHere =
      runningEntry?.projectId === project.id && runningEntry.pausedAt == null;

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-current", String(isActive));
    button.setAttribute(
      "aria-label",
      `${isRunningHere ? "Stop tracking" : "Track"} ${project.name}`,
    );
    button.classList.toggle("is-running", isRunningHere);
    // Each row starts a timer, so none can work while tracking is blocked.
    // The banner above already says why; a red error repeating it is noise.
    button.disabled = trackingToggleBlocked;

    const iconWrapper = document.createElement("span");
    iconWrapper.className = "project-icon";
    iconWrapper.setAttribute("aria-hidden", "true");
    if (isRunningHere) {
      // Three level bars: this one is live.
      for (let bar = 0; bar < 3; bar++) {
        const barEl = document.createElement("span");
        barEl.className = "project-icon-bar";
        iconWrapper.appendChild(barEl);
      }
    } else {
      const icon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("width", "12");
      icon.setAttribute("height", "12");
      const iconPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      iconPath.setAttribute("d", "M7 4.5v15l13-7.5z");
      iconPath.setAttribute("fill", "currentColor");
      icon.appendChild(iconPath);
      iconWrapper.appendChild(icon);
    }

    const label = document.createElement("span");
    label.className = "project-name";
    label.textContent = project.client
      ? `${project.name} (${project.client})`
      : project.name;

    const text = document.createElement("span");
    text.className = "project-text";
    text.append(label);

    const total = document.createElement("span");
    total.className = "project-total";
    total.textContent = formatHoursMinutes(displayedSecondsFor(project.id));

    projectTotalElements.set(project.id, total);
    button.append(iconWrapper, text, total);
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
  if (trackingToggleBlocked) return;
  clearTrackingError();

  // Clicking the row that is currently running pauses it — the row shows a
  // pause icon, so doing nothing would make that icon a lie.
  if (runningEntry?.projectId === projectId && !runningEntry.pausedAt) {
    const paused = await window.api.tracking.pause();

    if (paused.ok) setRunning(null);
    else handleTrackingFailure(paused);
    return;
  }

  pendingTaskChoice = null;
  await loadTasks(projectId);
  const taskId = selectedTaskId;

  const result = runningEntry
    ? await window.api.tracking.switchTo(projectId, taskId)
    : await window.api.tracking.start(projectId, taskId);

  if (!result.ok) {
    handleTrackingFailure(result);
    return;
  }
  setRunning(result.data);
}

// --- Window-tracking permission banner ----------------------------------

async function refreshCapturePermissionBanner(): Promise<CapturePermissionStatus | null> {
  const result = await window.api.tracking.permissionStatus();
  if (!result.ok) return null;
  const status = result.data;

  // Screen Recording is what window titles and screenshots need — titles
  // only matter while apps are tracked at all.
  const isMacCaptureGate =
    status.platform === "macos" &&
    ((status.appUrlTracking !== "off" && status.windowTrackingEnabled) ||
      status.screenshotsEnabled);
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

  // Accessibility serves Firefox's URLs only, so it's asked for only while
  // URLs are tracked.
  accessibilityBanner.hidden = !(
    status.platform === "macos" &&
    status.appUrlTracking === "apps_urls" &&
    !status.accessibilityGranted
  );
  accessibilityBannerMessage.textContent = status.accessibilityGuidance;

  return status;
}

function stopScreenRecordingGrantPolling(): void {
  if (screenRecordingPollHandle) clearInterval(screenRecordingPollHandle);
  screenRecordingPollHandle = null;
}

screenRecordingGrantButton.addEventListener("click", () => {
  void window.api.tracking.requestScreenRecordingAccess().then(() => {
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
  void window.api.tracking.openPrivacySettings("screenRecording");
});

accessibilitySettingsButton.addEventListener("click", () => {
  void window.api.tracking.openPrivacySettings("accessibility");
});

/**
 * "signedOut" means the login screen is already showing; "failed" means the
 * request didn't get through (the real error is on screen) and the list is
 * still empty — callers chaining further tracking setup should stop either way.
 */
async function loadProjects(): Promise<"ok" | "failed" | "signedOut"> {
  const result = await window.api.tracking.listProjects();
  if (!result.ok) {
    handleTrackingFailure(result);
    return result.unauthorized ? "signedOut" : "failed";
  }

  projects = result.data;
  projectsLoaded = true;
  await refreshTodayTotals();
  renderProjects();

  if (projects.length > 0) {
    await loadTasks(projects[0].id);
  }
  return "ok";
}

function updateCurrentTaskLabel(): void {
  const task = currentProjectTasks.find((t) => t.id === selectedTaskId);
  currentTaskLabelEl.textContent = task ? task.name : "No task";
}

async function loadTasks(projectId: string): Promise<void> {
  const result = await callTracking(() =>
    window.api.tracking.listTasks(projectId),
  );
  currentProjectTasks = [];
  selectedTaskId = null;
  tasksProjectId = projectId;
  if (!result.ok) {
    // Offline, tasks are optional and starting/switching still works (it is
    // queued), so only a real rejection or a sign-out is worth a banner.
    if (result.unauthorized || result.status !== undefined) {
      handleTrackingFailure(result);
    }
    updateCurrentTaskLabel();
    return;
  }

  currentProjectTasks = result.data.tasks.filter(
    (task) => task.status !== "closed",
  );
  updateCurrentTaskLabel();
}

function formatTaskDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function renderTaskPanelList(): void {
  const query = taskSearch.value.trim().toLowerCase();
  const matches = currentProjectTasks.filter(
    (task) =>
      !query ||
      task.name.toLowerCase().includes(query) ||
      (task.description ?? "").toLowerCase().includes(query),
  );

  taskPanelList.innerHTML = "";

  const noTaskButton = document.createElement("button");
  noTaskButton.type = "button";
  noTaskButton.textContent = "No task";
  noTaskButton.classList.toggle("is-selected", selectedTaskId === null);
  noTaskButton.addEventListener("click", () => void chooseTask(null));
  const noTaskItem = document.createElement("li");
  noTaskItem.appendChild(noTaskButton);
  taskPanelList.appendChild(noTaskItem);

  for (const task of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("is-selected", selectedTaskId === task.id);

    const name = document.createElement("span");
    name.className = "task-panel-task-name";
    name.textContent = task.name;
    button.appendChild(name);

    if (task.description) {
      const description = document.createElement("span");
      description.className = "task-panel-description";
      description.textContent = task.description;
      button.appendChild(description);
    }

    const dates = document.createElement("span");
    dates.className = "task-panel-dates";
    dates.textContent = `Created ${formatTaskDate(task.createdAt)} · Updated ${formatTaskDate(task.updatedAt)}`;
    button.appendChild(dates);

    button.addEventListener("click", () => void chooseTask(task.id));

    const item = document.createElement("li");
    item.appendChild(button);
    taskPanelList.appendChild(item);
  }

  taskPanelEmpty.hidden = matches.length > 0;
}

/** The Task the timer is on — or, when stopped, the one play would start on. */
async function currentTaskFor(projectId: string): Promise<string | null> {
  if (runningEntry?.projectId === projectId) return runningEntry.taskId;
  if (pendingTaskChoice?.projectId === projectId) {
    return pendingTaskChoice.taskId;
  }
  const remembered = await window.api.tracking.lastProject();
  return remembered?.projectId === projectId ? remembered.taskId : null;
}

async function openTaskPanel(): Promise<void> {
  const projectId =
    runningEntry?.projectId ?? lastTrackedProjectId ?? projects[0]?.id;
  if (!projectId) return;

  const taskId = await currentTaskFor(projectId);
  await loadTasks(projectId);
  if (currentProjectTasks.some((task) => task.id === taskId)) {
    selectedTaskId = taskId;
    updateCurrentTaskLabel();
  }
  taskPanelProject.textContent = projectNameFor(projectId);
  taskSearch.value = "";
  renderTaskPanelList();
  taskPanel.hidden = false;
  taskSearch.focus();
}

function closeTaskPanel(): void {
  taskPanel.hidden = true;
}

/**
 * Puts the timer on a Task. Running, that's a switch — the time so far stays
 * on the old Task; stopped, the next play starts on it.
 */
async function chooseTask(taskId: string | null): Promise<void> {
  selectedTaskId = taskId;
  updateCurrentTaskLabel();
  closeTaskPanel();
  const projectId = tasksProjectId;
  if (!projectId) return;

  if (!runningEntry || runningEntry.pausedAt) {
    pendingTaskChoice = { projectId, taskId };
    return;
  }
  if (runningEntry.projectId !== projectId || runningEntry.taskId === taskId) {
    return;
  }

  const previousTaskId = runningEntry.taskId;
  clearTrackingError();
  const result = await callTracking(() =>
    window.api.tracking.switchTo(projectId, taskId),
  );
  if (result.ok) {
    setRunning(result.data);
    return;
  }
  // Still on the old task, so the label shouldn't claim otherwise.
  selectedTaskId = previousTaskId;
  updateCurrentTaskLabel();
  handleTrackingFailure(result);
}

taskTrigger.addEventListener("click", () => void openTaskPanel());
projectSearch.addEventListener("input", renderProjects);
taskPanelClose.addEventListener("click", closeTaskPanel);
taskSearch.addEventListener("input", renderTaskPanelList);

/** Local midnight that starts the current calendar day, in the machine's own timezone. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

async function reconcileDayBoundary(entry: TimeEntry): Promise<boolean> {
  if (new Date(entry.startedAt).getTime() >= startOfToday()) return false;

  if (entry.pausedAt) {
    const result = await callTracking(() =>
      window.api.tracking.stop(entry.pausedAt!),
    );
    if (!result.ok) return false;
    setRunning(null);
  } else {
    const result = await callTracking(() =>
      window.api.tracking.switchTo(entry.projectId, entry.taskId),
    );
    if (!result.ok) return false;
    setRunning(result.data);
  }
  // A new day: yesterday's totals no longer apply.
  await refreshTodayTotals();
  tick();
  return true;
}

/**
 * Polls the server for the running entry. The displayed time runs on this
 * device's clock and is re-read from the server only when `resync` is set
 * (the app opening or reopening), when the running entry was started or
 * stopped somewhere else, or when the day rolls over — never just because
 * the server's count differs from ours.
 */
async function refreshStatus(resync = false): Promise<void> {
  const versionAtStart = runningStateVersion;
  const result = await callTracking(() => window.api.tracking.status());
  if (!result.ok) {
    if (result.unauthorized) {
      showLoginView(result.message);
      return;
    }

    syncFailing = true;
    updateSyncStatus();
    return;
  }
  syncFailing = false;
  lastSyncedAt = Date.now();
  // Re-read now and then, so an admin's change to idle handling reaches a
  // signed-in desktop — and a missed first fetch doesn't leave it off.
  if (!idlePolicy || Date.now() - idlePolicyLoadedAt > IDLE_POLICY_REFRESH_MS) {
    void loadIdlePolicy();
  }
  serverOffsetMs = new Date(result.data.now).getTime() - Date.now();
  const workedMs = (result.data.workedSeconds ?? 0) * 1000;
  const receivedAt = Date.now();

  // Reported for a couple of minutes after the stop, so it reaches this
  // client even when another one's poll did the stopping — hence shown
  // once per stop here rather than once per report.
  const limit = result.data.limitReached;
  const limitKey = limit ? `${limit.kind}:${limit.limitHours}` : null;
  if (limitKey && limitKey !== shownLimitKey) {
    shownLimitKey = limitKey;
    showTimerStoppedByLimit(limit!);
  } else if (!limitKey) {
    shownLimitKey = null;
  }

  const entry = result.data.entry;
  if (entry && (await reconcileDayBoundary(entry))) {
    return; // reconcile already applied the correct state
  }
  // A click finished mid-poll; applying this snapshot would revert it.
  if (versionAtStart !== runningStateVersion) return;

  const changedElsewhere = (entry?.id ?? null) !== (runningEntry?.id ?? null);
  setRunning(entry);
  if (resync || changedElsewhere) {
    accountWorkedMs = workedMs;
    accountWorkedMsAt = receivedAt;
    if (entry?.pausedAt) pausedAtWorkedMs = workedMs;
    tick();
  } else if (todaySecondsDayStart === startOfToday()) {
    // Totals are already this day's, so nothing needs re-deriving — but
    // time added from the web console changes neither the running entry
    // nor the day, so without this it would never appear here at all.
    if (Date.now() - todaySecondsReconciledAt >= TODAY_MERGE_INTERVAL_MS) {
      await mergeNewTodayEntries();
    }
    return;
  }
  // Also reached when the day rolled over, or the totals never loaded.
  await refreshTodayTotals();
  tick();
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
  stopScreenRecordingGrantPolling();
}

/**
 * Resolves which Project a start should track against, so neither
 * play nor the stopped timer card ever has to prompt:
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

/** Starts a new entry against the resolved Project, when play is pressed. */
async function startTracking(): Promise<void> {
  if (!projectsLoaded) {
    // Setup is still waiting on its retry. Retrying now reaches the server,
    // so an ended session lands on the login screen instead of "No projects".
    await initTracking();
    // Signed out, still unreachable, or a timer turned up running elsewhere.
    if (!projectsLoaded || runningEntry) return;
  }
  clearTrackingError();
  const resolved = await resolveProjectToTrack();
  if (!resolved) {
    showTrackingError("No projects are available to track time against.");
    return;
  }
  const target =
    pendingTaskChoice?.projectId === resolved.projectId
      ? pendingTaskChoice
      : resolved;
  pendingTaskChoice = null;

  void loadTasks(target.projectId).then(() => {
    if (target.taskId) {
      selectedTaskId = target.taskId;
      updateCurrentTaskLabel();
    }
  });

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

/** Set while the organisation tracks from another client. */
let trackingToggleBlocked = false;

timerToggle.addEventListener("click", () => {
  void (async () => {
    timerToggle.disabled = true;
    try {
      if (!runningEntry) {
        await startTracking();
        return;
      }

      clearTrackingError();
      // `pausedAt` is never set any more — pausing ends the entry — so this
      // always pauses, and starting again goes through the `!runningEntry`
      // branch above. `resume` stays reachable for an older agent.
      const result = runningEntry.pausedAt
        ? await window.api.tracking.resume()
        : await window.api.tracking.pause();
      if (result.ok) {
        setRunning(result.data.endedAt ? null : result.data);
      } else if (/no timer is currently running/i.test(result.message)) {
        // Already stopped server-side: resync instead of showing an error.
        await refreshStatus();
      } else {
        handleTrackingFailure(result);
      }
    } finally {
      timerToggle.disabled = trackingToggleBlocked;
    }
  })();
});

// Both bars' buttons do exactly what the full window's does.
for (const button of [compactTimerToggle, miniTimerToggle]) {
  button.addEventListener("click", () => {
    if (!timerToggle.disabled) timerToggle.click();
  });
}

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
      // That ended the entry running elsewhere, which this device never
      // counted — only the server has its time.
      await refreshTodayTotals();
      tick();
    } else {
      handleTrackingFailure(result);
    }
  })();
});

idleKeepButton.addEventListener("click", () => {
  hideIdleBanner();
  // Re-arm for the next idle stretch — input may have resumed polls ago,
  // so checkIdle won't see a fresh drop to reset this itself.
  idleHandled = false;
});

/**
 * Ends the entry at when idleness started, then starts a fresh one on the
 * same Project and Task — either now, dropping the idle stretch, or back at
 * idle start onto `assignTo`, moving the stretch to that Project instead.
 */
async function resolveIdleTime(assignTo?: string): Promise<void> {
  if (!pendingIdleDiscardAt || !runningEntry) return;
  const discardAt = pendingIdleDiscardAt;
  const projectId = assignTo ?? runningEntry.projectId;
  // A Task belongs to one Project, so it can't follow the time elsewhere.
  const taskId = assignTo ? null : runningEntry.taskId;
  hideIdleBanner();

  const stopResult = await callTracking(() =>
    window.api.tracking.stop(discardAt),
  );
  if (!stopResult.ok) {
    handleTrackingFailure(stopResult);
    return;
  }
  setRunning(null);

  const startResult = await callTracking(() =>
    window.api.tracking.start(projectId, taskId, assignTo ? discardAt : undefined),
  );
  // This device counted the idle stretch on the old Project; the server's
  // totals have it dropped or moved.
  await refreshTodayTotals();
  if (startResult.ok) {
    setRunning(startResult.data);
  } else {
    handleTrackingFailure(startResult);
  }
}

idleDiscardButton.addEventListener("click", () => {
  void resolveIdleTime();
});

idleAssignToggle.addEventListener("click", () => {
  idleAssignList.hidden = !idleAssignList.hidden;
  if (idleAssignList.hidden) return;

  idleAssignList.innerHTML = "";
  const otherProjects = projects.filter(
    (project) => project.id !== runningEntry?.projectId,
  );
  for (const project of otherProjects) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = project.name;
    button.addEventListener(
      "click",
      () => void resolveIdleTime(project.id),
    );

    const item = document.createElement("li");
    item.appendChild(button);
    idleAssignList.appendChild(item);
  }
});

async function loadIdlePolicy(): Promise<void> {
  const result = await callTracking(() => window.api.tracking.idlePolicy());
  if (result.ok) {
    idlePolicy = result.data;
    idlePolicyLoadedAt = Date.now();
  }
}

let trackingRetryHandle: ReturnType<typeof setTimeout> | null = null;

function cancelTrackingRetry(): void {
  if (trackingRetryHandle) clearTimeout(trackingRetryHandle);
  trackingRetryHandle = null;
}

let initTrackingRun: Promise<void> | null = null;

/** Joins a setup already in flight — a play click and a scheduled retry must not both start a timer. */
function initTracking(): Promise<void> {
  initTrackingRun ??= runInitTracking().finally(() => {
    initTrackingRun = null;
  });
  return initTrackingRun;
}

async function runInitTracking(): Promise<void> {
  cancelTrackingRetry();
  clearTrackingError();
  const projectsResult = await loadProjects();
  if (projectsResult === "signedOut") return; // already on the login screen
  if (projectsResult === "failed") {
    // Autostart at OS login often runs before the network is up. Without a
    // retry the list stays empty for the whole session — only logging out
    // and back in (which reruns this) used to recover it.
    trackingRetryHandle = setTimeout(
      () => void initTracking(),
      STATUS_POLL_INTERVAL_MS,
    );
    return;
  }

  await loadIdlePolicy();

  await refreshStatus(true);

  // Never starts the timer: quitting stopped it, and only the person
  // pressing play starts it again. Shows what play would resume instead,
  // with that Project's time so far today.
  if (!runningEntry && !lastTrackedProjectId) {
    const target = await resolveProjectToTrack();
    if (target && !runningEntry) {
      lastTrackedProjectId = target.projectId;
      renderProjects();
      tick();
    }
  }

  void refreshCapturePermissionBanner();
  startPolling();
}

/**
 * An admin restricting tracking to another client. The server has already
 * ended any running entry, so this only says so and stops offering
 * buttons that would be refused. Neutral styling, not `error-text`.
 */
function hideTrackingReminder(): void {
  reminderBanner.hidden = true;
}

reminderDismissButton.addEventListener("click", hideTrackingReminder);
reminderStartButton.addEventListener("click", () => {
  hideTrackingReminder();
  // The main toggle's own path, so this can never start a timer it
  // would have refused.
  if (!timerToggle.disabled) timerToggle.click();
});

window.api.windowControls.onTrackingReminder((message) => {
  // The banner lives in the tracking view, which the smaller sizes
  // hide; centred, because growing from a corner runs off screen.
  setMode("full", true);
  reminderBannerMessage.textContent = message;
  reminderBanner.hidden = false;
  // Again now the resize is done: main raises before any of this runs,
  // and going full drops the always-on-top the smaller views hold.
  void window.api.windowControls.show();
});

window.api.windowControls.onTrackingNotice((notice) => {
  trackingNotice.textContent = notice ?? "";
  // Truthiness, not `!== null`: an older main process sends `undefined`,
  // which must not show an empty banner and disable the toggle.
  trackingNotice.hidden = !notice;
  trackingToggleBlocked = Boolean(notice);
  timerToggle.disabled = trackingToggleBlocked;
  compactTimerToggle.disabled = trackingToggleBlocked;
  renderProjects();
  if (notice) void refreshStatus(true);
});

// Closing the window only hides it to the tray, so reopening it doesn't rerun
// setup — re-read the day's time from the server here instead.
window.api.windowControls.onReopened(() => {
  if (pollHandle) void refreshStatus(true);
});

void init();
