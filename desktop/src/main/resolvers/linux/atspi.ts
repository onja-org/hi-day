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
const WINDOW_ACTIVATE_EVENT = 'window:activate';

/**
 * Signal tracing, sharing the main process's own opt-in switch — the
 * side-car inherits its environment, so turning on the debug harness turns
 * this on too, and neither costs anything when off.
 */
const TRACE_SIGNALS = process.env.WORKFORCE_MONITOR_DEBUG_URL_CAPTURE === '1';
const TRACE_SUMMARY_MS = 30_000;

/**
 * Fallback signatures, newest first, for a registry that will not
 * introspect: at-spi2 2.46+ then 2.44-and-earlier.
 */
export const KNOWN_REGISTER_EVENT_SIGNATURES = ['sass', 's'];

/** D-Bus integer and floating-point type codes. */
const NUMERIC_TYPE_CODES = new Set(['y', 'n', 'q', 'i', 'u', 'x', 't', 'd']);

/**
 * Splits a D-Bus signature into its top-level argument types, so `"sass"`
 * becomes `['s', 'as', 's']`. Array prefixes bind to the type that follows
 * and structs/dicts nest, both of which a plain character split gets wrong.
 */
export function splitSignature(signature: string): string[] {
  const types: string[] = [];
  let index = 0;

  while (index < signature.length) {
    const start = index;
    while (signature[index] === 'a') index += 1;

    const opener = signature[index];
    if (opener === '(' || opener === '{') {
      const closer = opener === '(' ? ')' : '}';
      let depth = 0;
      do {
        if (signature[index] === opener) depth += 1;
        else if (signature[index] === closer) depth -= 1;
        index += 1;
      } while (index < signature.length && depth > 0);
    } else {
      index += 1;
    }

    types.push(signature.slice(start, index));
  }

  return types;
}

/**
 * Builds a plausible argument list for a `RegisterEvent` of the given
 * signature: the first string is the event name, any later string is the
 * optional bus-name filter (empty means "any application"), and arrays are
 * the empty property list. Returns null for a signature carrying a type we
 * cannot invent a value for, so the caller skips it rather than sending
 * something the registry will reject.
 */
export function argumentsForSignature(signature: string, event: string): unknown[] | null {
  let eventPlaced = false;
  const args: unknown[] = [];

  for (const type of splitSignature(signature)) {
    if (type === 's') {
      args.push(eventPlaced ? '' : event);
      eventPlaced = true;
    } else if (type.startsWith('a')) {
      args.push([]);
    } else if (type === 'b') {
      args.push(false);
    } else if (NUMERIC_TYPE_CODES.has(type)) {
      args.push(0);
    } else {
      return null;
    }
  }

  return eventPlaced ? args : null;
}

/**
 * Reads `RegisterEvent`'s input signature out of an introspection
 * document. The spec defaults a method argument's direction to `in`, so an
 * `<arg>` with no direction counts.
 */
export function registerEventSignatureFromXml(xml: string): string | null {
  const method = /<method\s+name="RegisterEvent"\s*>([\s\S]*?)<\/method>/.exec(xml);
  if (!method) return null;

  const signature = [...method[1].matchAll(/<arg\b[^>]*>/g)]
    .filter((tag) => !/direction="out"/.test(tag[0]))
    .map((tag) => /type="([^"]+)"/.exec(tag[0])?.[1] ?? '')
    .join('');

  return signature.length > 0 ? signature : null;
}

/**
 * Raised when the registry accepted a registration it did not record. Named
 * so the side-car can report it as its own condition rather than as a
 * missing accessibility bus — the bus is fine; we are simply not on it.
 */
export class EventRegistrationError extends Error {}

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
  private readonly signalCounts = new Map<string, number>();
  private traceTimer: ReturnType<typeof setInterval> | null = null;

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
    // clients.
    await this.registerWindowActivate(bus);

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
      this.trace(message);
      if (message.interface !== WINDOW_EVENT_IFACE || message.member !== 'Activate') return;
      if (!message.sender || !message.path) return;
      void this.handleActivate(message.sender, message.path);
    });

    if (TRACE_SIGNALS) this.startTraceSummary();
  }

  /**
   * Records every signal this connection receives, *before* any filtering.
   *
   * The handler above drops anything it doesn't match without a word, which
   * left one question unanswerable: when a browser's activation never
   * reaches the session, is the message arriving and being filtered out, or
   * not arriving at all? Those have entirely different causes, and no log
   * distinguished them.
   *
   * Window events are printed individually — they are rare and are the ones
   * in question. Everything else is only counted, because a single terminal
   * emitting text can produce hundreds of signals a minute and would bury
   * the line worth reading.
   */
  private trace(message: dbus.Message): void {
    if (!TRACE_SIGNALS) return;

    const iface = message.interface ?? '(none)';
    if (iface.startsWith(WINDOW_EVENT_IFACE)) {
      this.logger(
        `[atspi-trace] window signal member=${message.member ?? '?'} ` +
          `sender=${message.sender ?? '?'} path=${message.path ?? '?'}`,
      );
      return;
    }

    const key = `${iface}.${message.member ?? '?'}`;
    this.signalCounts.set(key, (this.signalCounts.get(key) ?? 0) + 1);
  }

  /** Periodic digest of the signals that were only counted, so a quiet connection is distinguishable from a busy one. */
  private startTraceSummary(): void {
    this.traceTimer = setInterval(() => {
      if (this.signalCounts.size === 0) {
        this.logger('[atspi-trace] no non-window signals in the last 30s');
        return;
      }
      const summary = [...this.signalCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([key, count]) => `${key}=${count}`)
        .join(' ');
      this.logger(`[atspi-trace] 30s: ${summary}`);
      this.signalCounts.clear();
    }, TRACE_SUMMARY_MS);
    this.traceTimer.unref?.();
  }

  /**
   * Registers for `window:activate` against whatever signature this
   * registry actually exposes, rather than a signature we assume.
   *
   * at-spi2 changed this method's arity: 2.46+ takes
   * `(event, properties, app_bus_name)`, 2.44 and earlier take `(event)`.
   * Ubuntu 24.04 ships 2.52 (three arguments), Ubuntu 22.04 and Pop!_OS
   * 22.04 ship 2.44 (one), Ubuntu 20.04 ships 2.36 (one). Sending the
   * three-argument form to an older registry does not raise — it accepts
   * the message and records nothing, so the resolver went on reporting
   * `caps=focus,url` while never receiving a focus event.
   *
   * Introspecting first means a future release that changes the arity
   * again is handled without another patch, and the known signatures below
   * are only a fallback for a registry that will not introspect. Every
   * attempt is verified against `GetRegisteredEvents`, because "the call
   * returned" has already proved not to mean "we are registered".
   */
  private async registerWindowActivate(bus: dbus.MessageBus): Promise<void> {
    const introspected = await this.registerEventSignature(bus);
    const candidates = [introspected, ...KNOWN_REGISTER_EVENT_SIGNATURES].filter(
      (signature, index, all): signature is string =>
        signature !== null && all.indexOf(signature) === index,
    );

    for (const signature of candidates) {
      const body = argumentsForSignature(signature, WINDOW_ACTIVATE_EVENT);
      if (!body) continue; // a signature we cannot construct arguments for

      try {
        await callOn(
          bus, REGISTRY_NAME, REGISTRY_PATH, REGISTRY_NAME, 'RegisterEvent', signature, body,
        );
      } catch {
        continue; // wrong arity for this registry — try the next
      }

      if (await this.hasWindowActivateRegistration(bus)) return;
      this.logger(`[atspi] RegisterEvent(${signature}) was accepted but registered nothing`);
    }

    throw new EventRegistrationError(
      `The accessibility registry did not record a window:activate listener (tried: ${candidates.join(', ')}), ` +
        'so no focus events would ever arrive.',
    );
  }

  /** The registry's own `RegisterEvent` input signature, or null if it will not say. */
  private async registerEventSignature(bus: dbus.MessageBus): Promise<string | null> {
    try {
      const [xml] = await callOn<[string]>(
        bus, REGISTRY_NAME, REGISTRY_PATH, 'org.freedesktop.DBus.Introspectable', 'Introspect',
      );
      return registerEventSignatureFromXml(xml);
    } catch {
      return null;
    }
  }

  /**
   * Whether this connection appears in the registry's own list of event
   * listeners — the only way to tell a registration that took effect from
   * one that was silently dropped. A registry too old to expose
   * `GetRegisteredEvents` is given the benefit of the doubt.
   */
  private async hasWindowActivateRegistration(bus: dbus.MessageBus): Promise<boolean> {
    let events: [string, string][];
    try {
      [events] = await callOn<[[string, string][]]>(
        bus, REGISTRY_NAME, REGISTRY_PATH, REGISTRY_NAME, 'GetRegisteredEvents',
      );
    } catch {
      return true;
    }
    // dbus-next sets the connection's unique name on the bus but omits it
    // from its type definitions.
    const uniqueName = (bus as unknown as { name: string | null }).name;
    return events.some(
      ([listener, event]) =>
        listener === uniqueName && event.toLowerCase().startsWith('window:activate'),
    );
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
    if (this.traceTimer) clearInterval(this.traceTimer);
    this.traceTimer = null;
    this.bus?.disconnect();
    this.bus = null;
  }
}
