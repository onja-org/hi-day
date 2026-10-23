import type { MenuItemConstructorOptions } from 'electron';

/** How many Projects the tray offers under "Recent projects". */
export const RECENT_PROJECTS_LIMIT = 3;

/** Past this a Project name is cut short, so one long name cannot widen the whole menu. */
const MAX_PROJECT_LABEL_LENGTH = 40;

export interface TraySession {
  email: string;
  name?: string;
  organisationName: string;
}

export interface TrayMenuState {
  /** Null when signed out — the menu then offers nothing that needs an account. */
  session: TraySession | null;
  timerRunning: boolean;
  /** Already resolved to names and still-listed Projects; see `recentProjectsFor`. */
  recentProjects: { id: string; name: string }[];
  /** Null when there is no known web app to send anyone to. */
  webAppUrl: string | null;
  compactAlwaysOnTop: boolean;
  closeChoiceRemembered: boolean;
}

export interface TrayMenuActions {
  openApp: () => void;
  toggleTimer: () => void;
  trackProject: (projectId: string) => void;
  signOut: () => void;
  openWeb: (url: string) => void;
  toggleCompactAlwaysOnTop: () => void;
  forgetCloseChoice: () => void;
  checkForUpdates: () => void;
  showAbout: () => void;
  quit: () => void;
}

/**
 * The places on the web app the tray links to, under the `/open/…`
 * redirect, which finds the organisation the device itself does not know
 * (pairing gives the desktop a name, not an id).
 */
export const WEB_DESTINATIONS = {
  dashboard: '/dashboard',
  timesheet: '/open/timesheet',
  notes: '/open/notes',
} as const;

/**
 * Most recent first, without repeats, at most `limit` long — what a start
 * or a switch onto `projectId` does to the remembered list.
 */
export function withRecentProject(
  recent: readonly string[],
  projectId: string,
  limit = RECENT_PROJECTS_LIMIT,
): string[] {
  return [projectId, ...recent.filter((id) => id !== projectId)].slice(0, limit);
}

/**
 * The remembered ids as menu rows. An id the Project list no longer has
 * (archived, or access taken away) is dropped rather than shown as a
 * blank row that would fail when clicked.
 */
export function recentProjectsFor(
  recentIds: readonly string[],
  projects: readonly { id: string; name: string }[] | null,
): { id: string; name: string }[] {
  if (!projects) return [];
  return recentIds.flatMap((id) => {
    const project = projects.find((candidate) => candidate.id === id);
    return project ? [{ id, name: project.name }] : [];
  });
}

/**
 * A Project name made safe for a menu label: Windows and Linux read a
 * lone `&` as a keyboard-mnemonic marker and swallow it, so
 * "Research & Development" would show as "Research Development".
 */
export function menuLabelFor(name: string): string {
  const trimmed =
    name.length > MAX_PROJECT_LABEL_LENGTH
      ? `${name.slice(0, MAX_PROJECT_LABEL_LENGTH - 1).trimEnd()}…`
      : name;
  return trimmed.replace(/&/g, '&&');
}

function webLink(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

/**
 * The tray menu, grouped the way Hubstaff's is: the timer, recent
 * Projects, the account, the web app, then the app itself.
 */
export function trayMenuTemplate(
  state: TrayMenuState,
  actions: TrayMenuActions,
): MenuItemConstructorOptions[] {
  const signedIn = state.session !== null;
  const web = state.webAppUrl;
  const separator: MenuItemConstructorOptions = { type: 'separator' };
  const groups: MenuItemConstructorOptions[][] = [];

  groups.push([
    // One item reading whichever way the timer is not; a greyed
    // "Stop timer" says nothing the label cannot. Routed through the
    // renderer so this is not a second way to start a timer.
    ...(signedIn
      ? [
          {
            label: state.timerRunning ? 'Stop timer' : 'Start timer',
            click: actions.toggleTimer,
          },
        ]
      : []),
    ...(signedIn && web
      ? [
          {
            label: 'Add time note…',
            click: () => actions.openWeb(webLink(web, WEB_DESTINATIONS.notes)),
          },
        ]
      : []),
    { label: 'Open Hi Day', click: actions.openApp },
  ]);

  if (signedIn && state.recentProjects.length > 0) {
    groups.push([
      { label: 'Recent projects', enabled: false },
      ...state.recentProjects.map((project) => ({
        label: menuLabelFor(project.name),
        click: () => actions.trackProject(project.id),
      })),
    ]);
  }

  if (state.session) {
    const { name, email, organisationName } = state.session;
    groups.push([
      { label: `Signed in as ${name || email}`, enabled: false },
      ...(name ? [{ label: email, enabled: false }] : []),
      ...(organisationName ? [{ label: organisationName, enabled: false }] : []),
      { label: 'Sign out…', click: actions.signOut },
    ]);
  }

  // Absent only when a packaged build has never paired, and so has
  // nothing but a guess to offer — see `resolveWebAppUrl`.
  if (web) {
    groups.push([
      {
        label: 'Open dashboard',
        click: () => actions.openWeb(webLink(web, WEB_DESTINATIONS.dashboard)),
      },
      ...(signedIn
        ? [
            {
              label: 'Add/Edit time',
              click: () => actions.openWeb(webLink(web, WEB_DESTINATIONS.timesheet)),
            },
          ]
        : []),
    ]);
  }

  groups.push([
    {
      label: 'Preferences',
      submenu: [
        // A checkbox, so undoing it is the same item with its tick gone.
        // Named for what it governs: the full window never floats, and a
        // bare "Always on top" ticked while it is open would look broken.
        {
          label: 'Always on top (compact views)',
          type: 'checkbox',
          checked: state.compactAlwaysOnTop,
          click: actions.toggleCompactAlwaysOnTop,
        },
        // The only way back from a remembered close choice short of wiping
        // the app's data — without it, a remembered "Quit" is permanent.
        ...(state.closeChoiceRemembered
          ? [{ label: 'Ask before closing again', click: actions.forgetCloseChoice }]
          : []),
      ],
    },
    { label: 'Check for updates…', click: actions.checkForUpdates },
    { label: 'About Hi Day', click: actions.showAbout },
  ]);

  groups.push([{ label: 'Quit Hi Day', click: actions.quit }]);

  return groups.flatMap((group, index) => (index === 0 ? group : [separator, ...group]));
}
