import dbus from 'dbus-next';

/**
 * A minimal AT-SPI2 client speaking raw D-Bus, with no `pyatspi` (and
 * therefore no Python) anywhere in the chain.
 *
 * Why not the Python side-car docs/url-tracking-plan.md Step 19 originally
 * proposed: pyatspi is only a GObject-introspection wrapper over these same
 * D-Bus calls, and depending on it would have made `python3-pyatspi` (plus
 * `python3-gi`, `gir1.2-atspi-2.0`, `libatk-adaptor`) a hard runtime
 * dependency of the shipped .deb — see docs/url-tracking-toolchain.md's
 * Linux row. Talking to the same bus from Node keeps the entire resolver
 * inside the app's own TypeScript build (like darwin's, unlike win32's
 * separately-compiled .exe) and leaves `at-spi2-core` — already present on
 * any GNOME install — as the only thing that has to exist on the machine.
 *
 * Every call here is a hand-built `Message` rather than dbus-next's
 * `getProxyObject`: a proxy performs an `Introspect` round-trip per object,
 * and the address-bar search touches dozens of nodes per resolve. Raw
 * messages skip that entirely, and AT-SPI's introspection data is
 * incomplete for some nodes anyway (reading an application's `Name` through
 * a proxy returned empty where the direct property call returns the real
 * value — observed on GNOME 46).
 *
 * Verified against a real GNOME 46 / Wayland session: focus events arrive,
 * and Chrome's address bar reads back its real URL. See
 * native/linux/spike/RESULTS.md.
 */

const A11Y_BUS_NAME = 'org.a11y.Bus';
const A11Y_BUS_PATH = '/org/a11y/bus';
const REGISTRY_NAME = 'org.a11y.atspi.Registry';
const REGISTRY_PATH = '/org/a11y/atspi/registry';
const ACCESSIBLE_IFACE = 'org.a11y.atspi.Accessible';
const TEXT_IFACE = 'org.a11y.atspi.Text';
const PROPERTIES_IFACE = 'org.freedesktop.DBus.Properties';
const WINDOW_EVENT_IFACE = 'org.a11y.atspi.Event.Window';
const APPLICATION_ROOT_PATH = '/org/a11y/atspi/accessible/root';

/** Bounds the address-bar search — a browser's toolbar sits far above this depth. */
const MAX_SEARCH_DEPTH = 8;

/**
 * Roles a browser may use for its address bar. Chromium exposes an `entry`;
 * **Firefox exposes a `combo box`** (its awesomebar is a combobox that also
 * offers suggestions), which is why matching only `entry` silently captured
 * nothing at all from Firefox while working fine in Chrome — observed
 * directly on a real GNOME session.
 *
 * Still matched by ROLE and toolbar position only, never by the element's
 * name: Firefox labels this one "Search with Google or enter address",
 * which is localized and would break on any non-English build.
 */
export const ADDRESS_BAR_ROLES = new Set(['entry', 'combo box']);

/**
 * `AtspiStateType.FOCUSED` is bit 12 of the low word of the state bitfield.
 * Not 11 — that's `FOCUSABLE`, which an address bar always sets whether or
 * not it currently holds focus, so keying on it rejected every reading.
 * Verified on a real GNOME 46 Chrome window with the omnibox unfocused:
 * bit 11 set, bit 12 clear.
 */
const STATE_FOCUSED_BIT = 12;

export interface AtspiWindow {
  /** The owning application's unique D-Bus name, e.g. ":1.182". */
  bus: string;
  /** The window's accessible object path. */
  path: string;
  /** The owning application's accessible name, e.g. "Google Chrome". */
  appName: string;
  /** The window's own title, when it exposes one. */
  title: string;
}

export interface AtspiClientOptions {
  onWindowActivated: (window: AtspiWindow) => void;
  logger?: (line: string) => void;
}

/**
 * One raw method call. Module-level (not a class method) so `start()` can
 * use it against the session bus before `this.bus` exists.
 */
async function callOn<T>(
  bus: dbus.MessageBus,
  destination: string,
  path: string,
  iface: string,
  member: string,
  signature?: string,
  body: unknown[] = [],
): Promise<T> {
  const reply = await bus.call(
    new dbus.Message({
      destination,
      path,
      interface: iface,
      member,
      ...(signature ? { signature, body } : {}),
    }),
  );
  return (reply?.body ?? []) as T;
}

export class AtspiClient {
  private bus: dbus.MessageBus | null = null;
  private readonly logger: (line: string) => void;

  constructor(private readonly options: AtspiClientOptions) {
    this.logger = options.logger ?? ((): void => undefined);
  }

  /**
   * Resolves the a11y bus address off the session bus, connects to it, and
   * subscribes to window:activate. Throws if the accessibility bus isn't
   * reachable at all — the caller reports that as a missing capability
   * rather than crashing (see index.ts's support gate).
   */
  async start(): Promise<void> {
    const sessionBus = dbus.sessionBus();
    const [address] = await callOn<[string]>(
      sessionBus, A11Y_BUS_NAME, A11Y_BUS_PATH, A11Y_BUS_NAME, 'GetAddress',
    );

    const bus = dbus.sessionBus({ busAddress: address });
    this.bus = bus;

    // AT-SPI only emits an event to clients that have registered for it —
    // an AddMatch alone silently receives nothing. The third argument
    // (app bus name) is required by this interface version even though it
    // is empty for a global listener.
    await callOn(bus, REGISTRY_NAME, REGISTRY_PATH, REGISTRY_NAME, 'RegisterEvent', 'sass', [
      'window:activate',
      [],
      '',
    ]);

    await bus.call(
      new dbus.Message({
        destination: 'org.freedesktop.DBus',
        path: '/org/freedesktop/DBus',
        interface: 'org.freedesktop.DBus',
        member: 'AddMatch',
        signature: 's',
        body: [`type='signal',interface='${WINDOW_EVENT_IFACE}',member='Activate'`],
      }),
    );

    bus.on('message', (message: dbus.Message) => {
      if (message.type !== dbus.MessageType.SIGNAL) return;
      if (message.interface !== WINDOW_EVENT_IFACE || message.member !== 'Activate') return;
      if (!message.sender || !message.path) return;
      void this.handleActivate(message.sender, message.path);
    });
  }

  private async handleActivate(sender: string, path: string): Promise<void> {
    try {
      const [appName, title] = await Promise.all([
        this.readName(sender, APPLICATION_ROOT_PATH),
        this.readName(sender, path),
      ]);
      this.options.onWindowActivated({ bus: sender, path, appName, title });
    } catch (error) {
      this.logger(`[atspi] failed to describe activated window: ${String(error)}`);
    }
  }

  /**
   * Walks down from a window to the first address-bar-shaped node (see
   * ADDRESS_BAR_ROLES) that sits inside a TOOL BAR — matched by role and
   * structural position only, never by the element's accessible name, which
   * is localized (Step 19's explicit requirement). Returns null for a window
   * with no such node, which is the normal answer for any non-browser
   * application.
   */
  findAddressBarPath(bus: string, path: string): Promise<string | null> {
    return this.searchForAddressBar(bus, path, 0, false);
  }

  private async searchForAddressBar(
    bus: string,
    path: string,
    depth: number,
    insideToolbar: boolean,
  ): Promise<string | null> {
    if (depth > MAX_SEARCH_DEPTH) return null;

    let role: string;
    try {
      role = await this.getRoleName(bus, path);
    } catch {
      // A window can vanish mid-walk (tab closed, browser quit) — an
      // ordinary race, not an error worth propagating.
      return null;
    }

    if (insideToolbar && ADDRESS_BAR_ROLES.has(role)) return path;

    let children: [string, string][];
    try {
      children = await this.getChildren(bus, path);
    } catch {
      return null;
    }

    const nextInsideToolbar = insideToolbar || role === 'tool bar';
    for (const [childBus, childPath] of children) {
      const found = await this.searchForAddressBar(childBus, childPath, depth + 1, nextInsideToolbar);
      if (found) return found;
    }
    return null;
  }

  async readAddressBarText(bus: string, path: string): Promise<string> {
    const [text] = await this.call<[string]>(bus, path, TEXT_IFACE, 'GetText', 'ii', [0, -1]);
    return text;
  }

  /**
   * Whether the address bar currently holds keyboard focus — Step 21's rule
   * 1 ("reject if the address bar has keyboard focus: the user is typing").
   * Enforced resolver-side, because the pinned wire protocol carries no
   * field for this state, so a focused-omnibox reading must never leave
   * this process in the first place.
   */
  async isFocused(bus: string, path: string): Promise<boolean> {
    const [state] = await this.call<[[number, number]]>(bus, path, ACCESSIBLE_IFACE, 'GetState');
    return (state[0] & (1 << STATE_FOCUSED_BIT)) !== 0;
  }

  private async getRoleName(bus: string, path: string): Promise<string> {
    const [role] = await this.call<[string]>(bus, path, ACCESSIBLE_IFACE, 'GetRoleName');
    return role;
  }

  private async getChildren(bus: string, path: string): Promise<[string, string][]> {
    const [children] = await this.call<[[string, string][]]>(bus, path, ACCESSIBLE_IFACE, 'GetChildren');
    return children;
  }

  private async readName(bus: string, path: string): Promise<string> {
    try {
      const [variant] = await this.call<[dbus.Variant<string>]>(
        bus,
        path,
        PROPERTIES_IFACE,
        'Get',
        'ss',
        [ACCESSIBLE_IFACE, 'Name'],
      );
      return variant.value;
    } catch {
      return '';
    }
  }

  private call<T>(
    destination: string,
    path: string,
    iface: string,
    member: string,
    signature?: string,
    body: unknown[] = [],
  ): Promise<T> {
    return callOn<T>(this.requireBus(), destination, path, iface, member, signature, body);
  }

  private requireBus(): dbus.MessageBus {
    if (!this.bus) throw new Error('AtspiClient.start() has not completed.');
    return this.bus;
  }

  stop(): void {
    this.bus?.disconnect();
    this.bus = null;
  }
}
