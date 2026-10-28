import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import {
  menuLabelFor,
  recentProjectsFor,
  trayMenuTemplate,
  withRecentProject,
  type TrayMenuActions,
  type TrayMenuState,
} from '../tray-menu';

const signedIn: TrayMenuState = {
  session: { email: 'rinon@example.com', name: 'Rinon', organisationName: 'Onja' },
  timerRunning: false,
  recentProjects: [
    { id: 'p1', name: 'Development' },
    { id: 'p2', name: 'Hustle' },
  ],
  webAppUrl: 'https://app.example.com/',
  compactAlwaysOnTop: false,
  autoStartTimer: false,
  closeChoiceRemembered: false,
};

function actions(): TrayMenuActions {
  return {
    openApp: vi.fn(),
    toggleTimer: vi.fn(),
    trackProject: vi.fn(),
    signOut: vi.fn(),
    openWeb: vi.fn(),
    toggleCompactAlwaysOnTop: vi.fn(),
    toggleAutoStartTimer: vi.fn(),
    forgetCloseChoice: vi.fn(),
    checkForUpdates: vi.fn(),
    showAbout: vi.fn(),
    quit: vi.fn(),
  };
}

const labels = (items: MenuItemConstructorOptions[]): (string | undefined)[] =>
  items.map((item) => (item.type === 'separator' ? '---' : item.label));

function item(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions {
  const found = items.find((candidate) => candidate.label === label);
  if (!found) throw new Error(`no "${label}" in ${labels(items).join(', ')}`);
  return found;
}

const click = (entry: MenuItemConstructorOptions): void =>
  (entry.click as () => void)();

describe('the tray menu', () => {
  it('groups the timer, recent Projects, the account, the web app and the app', () => {
    expect(labels(trayMenuTemplate(signedIn, actions()))).toEqual([
      'Start timer',
      'Add time note…',
      'Open Hi Day',
      '---',
      'Recent projects',
      'Development',
      'Hustle',
      '---',
      'Signed in as Rinon',
      'rinon@example.com',
      'Onja',
      'Sign out…',
      '---',
      'Open dashboard',
      'Add/Edit time',
      '---',
      'Preferences',
      'Check for updates…',
      'About Hi Day',
      '---',
      'Quit Hi Day',
    ]);
  });

  it('reads whichever way the timer is not', () => {
    const menu = trayMenuTemplate({ ...signedIn, timerRunning: true }, actions());
    expect(labels(menu)).toContain('Stop timer');
    expect(labels(menu)).not.toContain('Start timer');
  });

  it('offers nothing that needs an account when signed out', () => {
    const menu = trayMenuTemplate({ ...signedIn, session: null }, actions());
    expect(labels(menu)).toEqual([
      'Open Hi Day',
      '---',
      'Open dashboard',
      '---',
      'Preferences',
      'Check for updates…',
      'About Hi Day',
      '---',
      'Quit Hi Day',
    ]);
  });

  it('leaves out the web links when there is no known web app', () => {
    const menu = labels(trayMenuTemplate({ ...signedIn, webAppUrl: null }, actions()));
    expect(menu).not.toContain('Open dashboard');
    expect(menu).not.toContain('Add/Edit time');
    expect(menu).not.toContain('Add time note…');
  });

  // An organisation with Projects off, or one nobody has tracked yet.
  it('drops the whole Recent projects section when there are none', () => {
    const menu = labels(trayMenuTemplate({ ...signedIn, recentProjects: [] }, actions()));
    expect(menu).not.toContain('Recent projects');
    expect(menu.slice(0, 5)).toEqual([
      'Start timer',
      'Add time note…',
      'Open Hi Day',
      '---',
      'Signed in as Rinon',
    ]);
  });

  it('shows the email alone for a session saved before names were', () => {
    const menu = labels(
      trayMenuTemplate(
        { ...signedIn, session: { email: 'rinon@example.com', organisationName: 'Onja' } },
        actions(),
      ),
    );
    expect(menu).toContain('Signed in as rinon@example.com');
    expect(menu.filter((label) => label === 'rinon@example.com')).toEqual([]);
  });

  it('keeps the account lines as labels, not actions', () => {
    const menu = trayMenuTemplate(signedIn, actions());
    expect(item(menu, 'Recent projects').enabled).toBe(false);
    expect(item(menu, 'Signed in as Rinon').enabled).toBe(false);
    expect(item(menu, 'rinon@example.com').enabled).toBe(false);
  });

  it('sends each item to its action', () => {
    const handlers = actions();
    const menu = trayMenuTemplate(signedIn, handlers);

    click(item(menu, 'Hustle'));
    expect(handlers.trackProject).toHaveBeenCalledWith('p2');

    click(item(menu, 'Start timer'));
    click(item(menu, 'Sign out…'));
    click(item(menu, 'Check for updates…'));
    click(item(menu, 'About Hi Day'));
    click(item(menu, 'Quit Hi Day'));
    expect(handlers.toggleTimer).toHaveBeenCalledOnce();
    expect(handlers.signOut).toHaveBeenCalledOnce();
    expect(handlers.checkForUpdates).toHaveBeenCalledOnce();
    expect(handlers.showAbout).toHaveBeenCalledOnce();
    expect(handlers.quit).toHaveBeenCalledOnce();
  });

  it('links to the web app without doubling its slash', () => {
    const handlers = actions();
    const menu = trayMenuTemplate(signedIn, handlers);

    click(item(menu, 'Open dashboard'));
    click(item(menu, 'Add/Edit time'));
    click(item(menu, 'Add time note…'));
    expect(vi.mocked(handlers.openWeb).mock.calls).toEqual([
      ['https://app.example.com/dashboard'],
      ['https://app.example.com/open/timesheet'],
      ['https://app.example.com/open/notes'],
    ]);
  });

  describe('Preferences', () => {
    const preferences = (state: TrayMenuState, handlers = actions()) =>
      item(trayMenuTemplate(state, handlers), 'Preferences')
        .submenu as MenuItemConstructorOptions[];

    it('ticks Always on top to match the preference', () => {
      const pinned = preferences({ ...signedIn, compactAlwaysOnTop: true });
      expect(item(pinned, 'Always on top (compact views)').checked).toBe(true);
      expect(
        item(preferences(signedIn), 'Always on top (compact views)').checked,
      ).toBe(false);
    });

    it('ticks the automatic start to match the preference, and toggles it', () => {
      const on = preferences({ ...signedIn, autoStartTimer: true });
      expect(item(on, 'Start timer when the computer starts').checked).toBe(true);

      const handlers = actions();
      click(
        item(preferences(signedIn, handlers), 'Start timer when the computer starts'),
      );
      expect(handlers.toggleAutoStartTimer).toHaveBeenCalledOnce();
    });

    // Nothing to track against, so the item would promise what it cannot do.
    it('leaves the automatic start out while signed out', () => {
      expect(labels(preferences({ ...signedIn, session: null }))).not.toContain(
        'Start timer when the computer starts',
      );
    });

    // The only way back from a remembered close choice.
    it('offers to ask before closing again only once a choice is remembered', () => {
      expect(labels(preferences(signedIn))).toEqual([
        'Always on top (compact views)',
        'Start timer when the computer starts',
      ]);

      const handlers = actions();
      const remembered = preferences({ ...signedIn, closeChoiceRemembered: true }, handlers);
      click(item(remembered, 'Ask before closing again'));
      expect(handlers.forgetCloseChoice).toHaveBeenCalledOnce();
    });
  });
});

describe('the recent Projects list', () => {
  it('puts the latest first without repeating it', () => {
    expect(withRecentProject(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('keeps only the newest three', () => {
    expect(withRecentProject(['a', 'b', 'c'], 'd')).toEqual(['d', 'a', 'b']);
  });

  it('names each id from the Project list, in the remembered order', () => {
    const projects = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ];
    expect(recentProjectsFor(['b', 'a'], projects)).toEqual([
      { id: 'b', name: 'Beta' },
      { id: 'a', name: 'Alpha' },
    ]);
  });

  // Archived, or access taken away since it was last tracked.
  it('drops a Project the list no longer has', () => {
    expect(recentProjectsFor(['gone', 'a'], [{ id: 'a', name: 'Alpha' }])).toEqual([
      { id: 'a', name: 'Alpha' },
    ]);
  });

  it('has nothing to show before the Project list has loaded', () => {
    expect(recentProjectsFor(['a'], null)).toEqual([]);
  });
});

describe('a Project name as a menu label', () => {
  it('keeps an ampersand from being read as a mnemonic', () => {
    expect(menuLabelFor('Research & Development')).toBe('Research && Development');
  });

  it('cuts a long name short', () => {
    const label = menuLabelFor('A'.repeat(60));
    expect(label).toHaveLength(40);
    expect(label.endsWith('…')).toBe(true);
  });

  it('leaves an ordinary name alone', () => {
    expect(menuLabelFor('School - Coding Course')).toBe('School - Coding Course');
  });
});
