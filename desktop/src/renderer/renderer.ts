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

const projectList = document.getElementById('project-list') as HTMLUListElement;
const taskSelect = document.getElementById('task-select') as HTMLSelectElement;
const timerDisplay = document.getElementById('timer-display')!;
const trackingError = document.getElementById('tracking-error')!;
const timerToggle = document.getElementById('timer-toggle') as HTMLButtonElement;
// Typed as Element, not HTMLElement: these are SVG nodes, which do not
// carry the HTML-only `hidden` property — toggleAttribute works on both.
const timerTogglePath = document.getElementById('timer-toggle-path') as unknown as Element;
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
  'M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z';
const PAUSE_PATH =
  'M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z';

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
 * Every tracking:* failure goes through this — `unauthorized` means the
 * backend has actually revoked this device's session (most commonly an
 * admin's remote sign-out from the Devices page), not a transient/network
 * failure, so this switches straight to the login screen instead of
 * showing an inline error the person would otherwise have to notice and
 * act on themselves. Without this, a remote sign-out had no visible effect
 * on the desktop app at all — it kept showing the logged-in UI
 * indefinitely, since every failure (including this one) was treated the
 * same as "server's briefly unreachable, try again next poll".
 */
function handleTrackingFailure(result: { message: string; unauthorized?: boolean }): void {
  if (result.unauthorized) {
    showLoginForm(result.message);
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
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
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
  // "Accumulating", not merely "an entry exists": a PAUSED entry is still
  // non-null (pause is a gap ledger — endedAt stays null so the
  // one-running-timer invariant holds), so keying the url-capture gate on
  // null-ness alone let capture keep accruing activeMs straight through a
  // pause. The engine's own gate is `timerRunning`, and while paused the
  // timer is by definition not running.
  const wasAccumulating = runningEntry !== null && runningEntry.pausedAt == null;
  runningEntry = entry;
  const isPaused = entry?.pausedAt != null;
  const isRunning = entry !== null && !isPaused;
  // One control, two faces: pause while running, play while stopped or
  // paused. Play both starts a fresh entry and resumes a paused one — from
  // the person's point of view that is the same gesture.
  // Same swap the project rows use: one path, re-pointed. Two stacked icons
  // toggled by `hidden` relied on the attribute hiding an SVG, and left both
  // glyphs sharing one button.
  timerTogglePath.setAttribute('d', isRunning ? PAUSE_PATH : PLAY_PATH);
  timerToggle.setAttribute(
    'aria-label',
    isRunning ? 'Pause timer' : entry ? 'Resume timer' : 'Start timer',
  );
  renderProjects();
  if (!entry) {
    idleHandled = false;
    lastIdleSeconds = 0;
    hideIdleBanner();
  }
  // The single place the renderer's own notion of "is time actually being
  // tracked" changes — mirror it to main so the url-capture session engine
  // (which has no other way to know) can gate on it too. Pausing closes the
  // open URL session; resuming lets the next reading open a fresh one.
  // Same condition the pause/play icon uses: URL capture accrues exactly
  // when the timer is visibly running.
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
  if (!runningEntry || runningEntry.pausedAt || !idlePolicy || idlePolicy.handling === 'off') {
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
    totals.set(entry.projectId, (totals.get(entry.projectId) ?? 0) + entry.durationSeconds);
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
  projectList.innerHTML = '';
  projectTotalElements.clear();

  for (const project of projects) {
    const isActive = runningEntry?.projectId === project.id;
    // Only the project actually accruing time counts as running — the
    // active-but-paused one still offers play, because that is what
    // clicking it does.
    const isRunningHere = isActive && runningEntry?.pausedAt == null;

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-current', String(isActive));
    button.classList.toggle('is-running', isRunningHere);

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 256 256');
    icon.setAttribute('width', '32');
    icon.setAttribute('height', '32');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('class', 'project-play');
    const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // The icon states what the click will do: pause the one that is
    // running, play anything else.
    iconPath.setAttribute('d', isRunningHere ? PAUSE_PATH : PLAY_PATH);
    iconPath.setAttribute('fill', 'currentColor');
    icon.appendChild(iconPath);

    const label = document.createElement('span');
    label.className = 'project-name';
    label.textContent = project.client ? `${project.name} (${project.client})` : project.name;

    const total = document.createElement('span');
    total.className = 'project-total';
    total.textContent = formatElapsed(displayedSecondsFor(project.id) * 1000);

    projectTotalElements.set(project.id, total);
    button.append(icon, label, total);
    button.addEventListener('click', () => void selectProject(project.id));

    const item = document.createElement('li');
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
  const result = await window.api.tracking.listTasks(projectId);
  taskSelect.innerHTML = '<option value="">No task</option>';
  if (!result.ok) {
    handleTrackingFailure(result);
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

/** Local midnight that starts the current calendar day, in the machine's own timezone. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Keeps the visible timer to TODAY only, per the daily-reset rule.
 *
 * An entry that began before local midnight is yesterday's work, and must
 * neither keep counting into today nor have today's time appended to it:
 *   - still running  -> switch to a fresh entry on the same Project, which
 *     is one atomic stop-then-start, so yesterday's total is closed at the
 *     boundary and today's time is recorded against a new entry.
 *   - already paused -> close it at the instant it was paused (never at
 *     "now", which would silently bill the intervening hours), and leave
 *     the screen with no running entry, i.e. 00:00:00.
 *
 * Returns true when it acted, so the caller skips the stale entry it was
 * about to render.
 */
async function reconcileDayBoundary(entry: TimeEntry): Promise<boolean> {
  if (new Date(entry.startedAt).getTime() >= startOfToday()) return false;

  if (entry.pausedAt) {
    const result = await window.api.tracking.stop(entry.pausedAt);
    if (result.ok) setRunning(null);
    return result.ok;
  }

  const result = await window.api.tracking.switchTo(entry.projectId, entry.taskId);
  if (result.ok) setRunning(result.data);
  return result.ok;
}

async function refreshStatus(): Promise<void> {
  const result = await window.api.tracking.status();
  if (!result.ok) {
    if (result.unauthorized) {
      // Not a transient/offline blip — the backend has actually revoked
      // this session (e.g. an admin's remote sign-out). Every future poll
      // would fail identically, so switch to the login screen right away
      // instead of silently retrying forever.
      showLoginForm(result.message);
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

/**
 * Resolves which Project a start should track against, so neither
 * auto-start nor the play icon ever has to prompt:
 *   1. whatever the timer last ran against, if it is still available, else
 *   2. the first Project in the list.
 * Returns null only when the account has no Projects at all.
 */
async function resolveProjectToTrack(): Promise<{ projectId: string; taskId: string | null } | null> {
  if (projects.length === 0) return null;

  const remembered = await window.api.tracking.lastProject();
  if (remembered && projects.some((project) => project.id === remembered.projectId)) {
    return remembered;
  }
  return { projectId: projects[0].id, taskId: null };
}

/** Starts a new entry against the resolved Project. Shared by auto-start and play. */
async function startTracking(): Promise<void> {
  clearTrackingError();
  const target = await resolveProjectToTrack();
  if (!target) {
    showTrackingError('No projects are available to track time against.');
    return;
  }

  await loadTasks(target.projectId);
  if (target.taskId) taskSelect.value = target.taskId;

  const result = await window.api.tracking.start(target.projectId, target.taskId);
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

timerToggle.addEventListener('click', () => {
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

switchButton.addEventListener('click', () => {
  void (async () => {
    if (!pendingSwitch) return;
    const { projectId, taskId } = pendingSwitch;
    const result = await window.api.tracking.switchTo(projectId, taskId);
    if (result.ok) {
      clearTrackingError();
      setRunning(result.data);
    } else {
      handleTrackingFailure(result);
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
      handleTrackingFailure(result);
    }
  })();
});

async function initTracking(): Promise<void> {
  clearTrackingError();
  const stillSignedIn = await loadProjects();
  if (!stillSignedIn) return; // loadProjects already switched to the login screen

  const idlePolicyResult = await window.api.tracking.idlePolicy();
  idlePolicy = idlePolicyResult.ok ? idlePolicyResult.data : null;

  // Settle the server's view BEFORE deciding whether to auto-start, so an
  // entry that is already running — or paused, e.g. by the last quit — is
  // respected rather than fought over with a duplicate start the backend
  // would reject with a 409. Ordered ahead of startPolling() so the
  // decision is made against a known state rather than racing its
  // fire-and-forget first refresh.
  await refreshStatus();

  // Auto-start: signing in is itself the intent to begin tracking, so no
  // click is required. Only fires when nothing is tracked yet — a paused
  // entry stays paused, which is what makes "close the app, reopen it, see
  // the same elapsed value, paused" work.
  if (!runningEntry) {
    await startTracking();
  }

  startPolling();
}

void init();
