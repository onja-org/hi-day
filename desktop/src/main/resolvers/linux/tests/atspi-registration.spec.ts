import { describe, expect, it, vi } from 'vitest';
import dbus from 'dbus-next';
import {
  AtspiClient,
  EventRegistrationError,
  argumentsForSignature,
  registerEventSignatureFromXml,
  splitSignature,
} from '../atspi';

/** Verbatim from `gdbus introspect` on Ubuntu 24.04, at-spi2-core 2.52.0. */
const MODERN_REGISTRY_XML = `<node><interface name="org.a11y.atspi.Registry"><method name="RegisterEvent"><arg direction="in" name="event" type="s" /><arg direction="in" name="properties" type="as" /><arg direction="in" name="app_bus_name" type="s" /></method><method name="GetRegisteredEvents"><arg direction="out" name="events" type="a(ss)" /></method></interface></node>`;

/** The shape Pop!_OS 22.04 / Ubuntu 22.04 and 20.04 report: one argument. */
const LEGACY_REGISTRY_XML = `<node><interface name="org.a11y.atspi.Registry"><method name="RegisterEvent"><arg direction="in" name="event" type="s" /></method><method name="DeregisterEvent"><arg direction="in" name="event" type="s" /></method></interface></node>`;

describe('reading the registry\'s own RegisterEvent signature', () => {
  it('reads the three-argument form shipped on Ubuntu 24.04', () => {
    expect(registerEventSignatureFromXml(MODERN_REGISTRY_XML)).toBe('sass');
  });

  it('reads the one-argument form shipped on Ubuntu 20.04 and 22.04', () => {
    expect(registerEventSignatureFromXml(LEGACY_REGISTRY_XML)).toBe('s');
  });

  it('ignores output arguments, which are not part of the call', () => {
    const xml = `<node><method name="RegisterEvent"><arg direction="in" type="s" /><arg direction="out" type="b" /></method></node>`;
    expect(registerEventSignatureFromXml(xml)).toBe('s');
  });

  it('treats an arg with no direction as an input, per the spec default', () => {
    const xml = `<node><method name="RegisterEvent"><arg name="event" type="s" /></method></node>`;
    expect(registerEventSignatureFromXml(xml)).toBe('s');
  });

  it('returns null when the method is absent rather than inventing one', () => {
    expect(registerEventSignatureFromXml('<node></node>')).toBeNull();
  });
});

describe('splitSignature — top-level argument types', () => {
  it('binds an array prefix to the type it qualifies', () => {
    expect(splitSignature('sass')).toEqual(['s', 'as', 's']);
  });

  it('keeps a struct together', () => {
    expect(splitSignature('a(ss)s')).toEqual(['a(ss)', 's']);
  });

  it('handles nested containers', () => {
    expect(splitSignature('aa{sv}b')).toEqual(['aa{sv}', 'b']);
  });
});

describe('argumentsForSignature — building a call for an unknown arity', () => {
  it('puts the event first and leaves the bus-name filter empty', () => {
    expect(argumentsForSignature('sass', 'window:activate')).toEqual(['window:activate', [], '']);
  });

  it('handles the single-argument form', () => {
    expect(argumentsForSignature('s', 'window:activate')).toEqual(['window:activate']);
  });

  /** A future arity is constructible as long as its types are ordinary. */
  it('constructs arguments for a signature we have never seen', () => {
    expect(argumentsForSignature('sassbu', 'window:activate')).toEqual([
      'window:activate',
      [],
      '',
      false,
      0,
    ]);
  });

  it('declines a signature with a type it cannot invent a value for', () => {
    expect(argumentsForSignature('sh', 'window:activate')).toBeNull();
  });

  it('declines a signature with nowhere to put the event name', () => {
    expect(argumentsForSignature('b', 'window:activate')).toBeNull();
  });
});

/**
 * The registry's `RegisterEvent` changed arity between at-spi2 releases:
 * 2.46+ takes (event, properties, app_bus_name), 2.44 and earlier take
 * (event). Pop!_OS 22.04 ships 2.44, and its registry accepts the
 * three-argument call without recording anything — the resolver then
 * reported caps=focus,url and never received a focus event.
 *
 * These drive a fake bus rather than a real one: the behaviour under test
 * is which call is made and whether the result is verified, neither of
 * which needs a live accessibility service.
 */

type Call = { member: string; signature?: string; body?: unknown[] };

function fakeBus(options: {
  /** Arities the fake registry accepts; others reject, as new at-spi2 does. */
  accepts: ('sass' | 's')[];
  /** Arities that actually record the listener, as old at-spi2 does not. */
  records: ('sass' | 's')[];
  /** Introspection document the fake registry returns; '' means it will not say. */
  xml?: string;
  /** Rejects anything that is not window:activate, as an older registry might. */
  rejectEnabling?: boolean;
  uniqueName?: string;
}): { bus: dbus.MessageBus; calls: Call[] } {
  const calls: Call[] = [];
  let registered = false;
  const uniqueName = options.uniqueName ?? ':1.99';

  const bus = {
    name: uniqueName,
    call: (message: { member: string; signature?: string; body?: unknown[] }) => {
      calls.push({ member: message.member, signature: message.signature, body: message.body });

      if (message.member === 'GetAddress') return Promise.resolve({ body: ['unix:path=/tmp/fake'] });
      if (message.member === 'Introspect') return Promise.resolve({ body: [options.xml ?? ''] });
      if (message.member === 'RegisterEvent') {
        const arity = message.signature as 'sass' | 's';
        if (options.rejectEnabling && message.body?.[0] !== 'window:activate') {
          return Promise.reject(new Error('unsupported event'));
        }
        if (!options.accepts.includes(arity)) {
          return Promise.reject(new Error(`no such method (${arity})`));
        }
        if (options.records.includes(arity)) registered = true;
        return Promise.resolve({ body: [] });
      }
      if (message.member === 'GetRegisteredEvents') {
        return Promise.resolve({ body: [registered ? [[uniqueName, 'Window:Activate:']] : []] });
      }
      return Promise.resolve({ body: [] });
    },
    on: () => undefined,
    disconnect: () => undefined,
  };

  return { bus: bus as unknown as dbus.MessageBus, calls };
}


/**
 * Only the `window:activate` registrations. The client also subscribes to
 * object events — see ENABLING_EVENTS — which are not what these assert on.
 */
function windowActivateAttempts(fake: { calls: Call[] }): Call[] {
  return fake.calls.filter(
    (c) => c.member === 'RegisterEvent' && c.body?.[0] === 'window:activate',
  );
}

function startWith(fake: ReturnType<typeof fakeBus>): Promise<void> {
  vi.spyOn(dbus, 'sessionBus').mockReturnValue(fake.bus);
  return new AtspiClient({ onWindowActivated: () => undefined }).start();
}

describe('AtspiClient — registering for window:activate across at-spi2 versions', () => {
  /**
   * The point of introspecting: an old registry is called correctly the
   * first time, rather than after a failed guess.
   */
  it('asks the registry which form it wants, and uses it directly', async () => {
    const fake = fakeBus({ accepts: ['sass', 's'], records: ['s'], xml: LEGACY_REGISTRY_XML });
    await expect(startWith(fake)).resolves.toBeUndefined();

    const attempts = windowActivateAttempts(fake);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].signature).toBe('s');
    vi.restoreAllMocks();
  });

  it('honours an introspected signature we have no hardcoded knowledge of', async () => {
    const xml = `<node><method name="RegisterEvent"><arg direction="in" type="s" /><arg direction="in" type="as" /><arg direction="in" type="s" /><arg direction="in" type="b" /></method></node>`;
    const fake = fakeBus({ accepts: ['sassb' as 'sass'], records: ['sassb' as 'sass'], xml });
    await expect(startWith(fake)).resolves.toBeUndefined();

    const attempts = windowActivateAttempts(fake);
    expect(attempts[0].signature).toBe('sassb');
    expect(attempts[0].body).toEqual(['window:activate', [], '', false]);
    vi.restoreAllMocks();
  });

  it('uses the three-argument form on a modern registry', async () => {
    const fake = fakeBus({ accepts: ['sass'], records: ['sass'] });
    await expect(startWith(fake)).resolves.toBeUndefined();

    const attempts = windowActivateAttempts(fake);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].signature).toBe('sass');
    vi.restoreAllMocks();
  });

  /** The Pop!_OS 22.04 case: accepted, silently not recorded. */
  it('falls back to the one-argument form when the modern call registers nothing', async () => {
    const fake = fakeBus({ accepts: ['sass', 's'], records: ['s'] });
    await expect(startWith(fake)).resolves.toBeUndefined();

    const signatures = windowActivateAttempts(fake).map((c) => c.signature);
    expect(signatures).toEqual(['sass', 's']);
    vi.restoreAllMocks();
  });

  it('falls back when the modern call is rejected outright', async () => {
    const fake = fakeBus({ accepts: ['s'], records: ['s'] });
    await expect(startWith(fake)).resolves.toBeUndefined();

    expect(windowActivateAttempts(fake).map((c) => c.signature)).toEqual([
      'sass',
      's',
    ]);
    vi.restoreAllMocks();
  });

  /**
   * The regression this all exists for: silence here is what made a broken
   * machine look identical to a healthy one.
   */
  it('fails loudly when no form registers, rather than reporting itself ready', async () => {
    const fake = fakeBus({ accepts: ['sass', 's'], records: [] });
    await expect(startWith(fake)).rejects.toBeInstanceOf(EventRegistrationError);
    vi.restoreAllMocks();
  });

  it('accepts a registry too old to list its listeners rather than failing on it', async () => {
    const calls: Call[] = [];
    const bus = {
      name: ':1.99',
      call: (m: { member: string; signature?: string }) => {
        calls.push({ member: m.member, signature: m.signature });
        if (m.member === 'GetAddress') return Promise.resolve({ body: ['unix:path=/tmp/fake'] });
        if (m.member === 'GetRegisteredEvents') return Promise.reject(new Error('unknown method'));
        return Promise.resolve({ body: [] });
      },
      on: () => undefined,
      disconnect: () => undefined,
    } as unknown as dbus.MessageBus;

    vi.spyOn(dbus, 'sessionBus').mockReturnValue(bus);
    await expect(
      new AtspiClient({ onWindowActivated: () => undefined }).start(),
    ).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});

describe('subscribing to object events so confined browsers speak', () => {
  /**
   * Chromium under snap confinement emits no window events at all to a
   * client subscribed only to window:activate. Brave, Opera and Vivaldi
   * looked silent for a day because of it.
   */
  it('also registers the enabling events once window:activate is recorded', async () => {
    const fake = fakeBus({ accepts: ['sass'], records: ['sass'] });
    await startWith(fake);

    const registered = fake.calls
      .filter((c) => c.member === 'RegisterEvent')
      .map((c) => c.body?.[0]);

    expect(registered).toContain('window:activate');
    expect(registered).toContain('object:state-changed');
    vi.restoreAllMocks();
  });

  it('still succeeds when the registry rejects them', async () => {
    const fake = fakeBus({ accepts: ['sass'], records: ['sass'], rejectEnabling: true });
    await expect(startWith(fake)).resolves.toBeUndefined();
    vi.restoreAllMocks();
  });
});
