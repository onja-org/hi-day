import dbus from 'dbus-next';

/**
 * A minimal AT-SPI2 client over raw D-Bus. No pyatspi, so `at-spi2-core`
 * (already on any GNOME install) is the only machine dependency and the
 * resolver stays inside this TypeScript build.
 *
 * Hand-built Messages rather than getProxyObject: a proxy costs an
 * Introspect round-trip per object, and the address-bar search touches
 * dozens of nodes. AT-SPI's introspection data is also incomplete for some
 * nodes on GNOME 46.
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

/**
 * Chrome, Brave, Edge and Firefox put the address bar around depth 4;
 * Opera nests its at 13, with the readable field at 15. The cost of the
 * deeper bound is held down by stopping at the first readable candidate.
 */
export const MAX_SEARCH_DEPTH = 18;

/**
 * Chromium exposes an `entry`, Firefox a `combo box`. Matched by role and
 * toolbar position only — the element's name is localized.
 */
export const ADDRESS_BAR_ROLES = new Set(['entry', 'combo box']);

/** FOCUSED is bit 12. Bit 11 is FOCUSABLE, which an address bar always sets. */
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

/**
 * U+FFFC stands in for an embedded child object, so a value of only those
 * carries no URL. This tells a real address bar from its decoys: Opera
 * wraps its field in an outer `entry`, Firefox puts a search-engine picker
 * in the same toolbar. Both have the right role and are wrong.
 */
export function hasReadableAddressBarText(text: string): boolean {
  return text.replace(/\uFFFC/g, '').trim().length > 0;
}

export class AtspiClient {
  private bus: dbus.MessageBus | null = null;
  private readonly logger: (line: string) => void;

  constructor(private readonly options: AtspiClientOptions) {
    this.logger = options.logger ?? ((): void => undefined);
  }

  /**
   * Connects to the a11y bus and subscribes to window:activate. Throws if
   * the bus is unreachable; the caller reports that as a missing capability.
   */
  async start(): Promise<void> {
    const sessionBus = dbus.sessionBus();
    const [address] = await callOn<[string]>(
      sessionBus, A11Y_BUS_NAME, A11Y_BUS_PATH, A11Y_BUS_NAME, 'GetAddress',
    );

    const bus = dbus.sessionBus({ busAddress: address });
    this.bus = bus;

    // AddMatch alone receives nothing — AT-SPI only emits to registered
    // clients. The empty third argument is required by this interface.
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
  async findAddressBarPath(bus: string, path: string): Promise<string | null> {
    // "First node of the right role" picks a decoy in Opera and Firefox,
    // so prefer the first candidate with readable text. The first match is
    // kept as a fallback for a genuinely empty bar.
    const fallback: { path: string | null } = { path: null };
    const readable = await this.searchForAddressBar(bus, path, 0, false, fallback);
    return readable ?? fallback.path;
  }

  private async searchForAddressBar(
    bus: string,
    path: string,
    depth: number,
    insideToolbar: boolean,
    fallback: { path: string | null },
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

    if (insideToolbar && ADDRESS_BAR_ROLES.has(role)) {
      if (await this.hasReadableText(bus, path)) return path;
      // Carry on: the real node may be nested inside this one or beside it.
      fallback.path ??= path;
    }

    let children: [string, string][];
    try {
      children = await this.getChildren(bus, path);
    } catch {
      return null;
    }

    const nextInsideToolbar = insideToolbar || role === 'tool bar';
    for (const [childBus, childPath] of children) {
      const found = await this.searchForAddressBar(
        childBus,
        childPath,
        depth + 1,
        nextInsideToolbar,
        fallback,
      );
      if (found) return found;
    }
    return null;
  }

  private async hasReadableText(bus: string, path: string): Promise<boolean> {
    try {
      return hasReadableAddressBarText(await this.readAddressBarText(bus, path));
    } catch {
      return false;
    }
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
