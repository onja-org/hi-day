import dbus from 'dbus-next';

/** One way of asking; null when this source has no answer here. */
export type LockQuery = () => Promise<boolean | null>;

/** A desktop that answers at all answers in a few milliseconds. */
const QUERY_TIMEOUT_MS = 1_000;

/**
 * Whether the session's screen is locked, for Linux, where Electron's
 * `lock-screen`/`unlock-screen` events never fire (macOS and Windows only).
 *
 * Asks every source there is, since no one of them covers every desktop:
 *
 * - systemd-logind's `LockedHint` on this session: set by GNOME, KDE Plasma
 *   and most desktops that lock through logind.
 * - `org.gnome.ScreenSaver.GetActive`: GNOME's own, which answers even for
 *   an app started outside the logind session.
 * - `org.freedesktop.ScreenSaver.GetActive`: KDE, XFCE and others (GNOME
 *   refuses it).
 *
 * Locked if any says so. A desktop where none can tell counts as unlocked —
 * screenshots then work exactly as they did before this check existed.
 */
export async function isScreenLocked(
  queries: LockQuery[] = DEFAULT_QUERIES,
  timeoutMs = QUERY_TIMEOUT_MS,
): Promise<boolean> {
  const answers = await Promise.all(queries.map((query) => withTimeout(query, timeoutMs)));
  return answers.some((answer) => answer === true);
}

async function withTimeout(query: LockQuery, timeoutMs: number): Promise<boolean | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      query().catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function ask(
  bus: dbus.MessageBus,
  message: ConstructorParameters<typeof dbus.Message>[0],
): Promise<unknown[]> {
  try {
    const reply = await bus.call(new dbus.Message(message));
    return (reply?.body ?? []) as unknown[];
  } finally {
    bus.disconnect();
  }
}

const logindLockedHint: LockQuery = async () => {
  const [variant] = await ask(dbus.systemBus(), {
    destination: 'org.freedesktop.login1',
    path: '/org/freedesktop/login1/session/auto',
    interface: 'org.freedesktop.DBus.Properties',
    member: 'Get',
    signature: 'ss',
    body: ['org.freedesktop.login1.Session', 'LockedHint'],
  });
  const value = (variant as { value?: unknown } | undefined)?.value;
  return typeof value === 'boolean' ? value : null;
};

const screenSaverActive =
  (name: string, path: string): LockQuery =>
  async () => {
    const [active] = await ask(dbus.sessionBus(), {
      destination: name,
      path,
      interface: name,
      member: 'GetActive',
    });
    return typeof active === 'boolean' ? active : null;
  };

const DEFAULT_QUERIES: LockQuery[] = [
  logindLockedHint,
  screenSaverActive('org.gnome.ScreenSaver', '/org/gnome/ScreenSaver'),
  screenSaverActive('org.freedesktop.ScreenSaver', '/org/freedesktop/ScreenSaver'),
];
