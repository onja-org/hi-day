import { describe, expect, it, vi } from 'vitest';
import dbus from 'dbus-next';
import { AtspiClient } from '../atspi';

/**
 * Firefox answers `GetChildren` on a frame with a single `menu` while its
 * `ChildCount` says 32 — and the tool bars it leaves out are where the
 * address bar lives, so the walk gave up one level above it and no Firefox
 * URL was ever read. Measured on a real session: frame ChildCount 32,
 * GetChildren 1, address bar at frame → child[27] → child[5] → child[2].
 */

type Node = {
  role: string;
  /** What `GetChildren` admits to — Firefox's is short. */
  reported: string[];
  /** What is really there, reachable only by index. */
  actual: string[];
  text?: string;
};

/** A frame that hides its tool bar behind a short `GetChildren`. */
function firefoxTree(): Record<string, Node> {
  return {
    '/win': { role: 'frame', reported: ['/menu'], actual: ['/menu', '/bar'] },
    '/menu': { role: 'menu', reported: [], actual: [] },
    '/bar': { role: 'tool bar', reported: ['/panel'], actual: ['/panel'] },
    '/panel': { role: 'panel', reported: ['/combo'], actual: ['/combo'] },
    '/combo': {
      role: 'combo box',
      reported: [],
      actual: [],
      text: 'www.youtube.com/shorts/IwtVwDgpUX4',
    },
  };
}

function fakeBus(tree: Record<string, Node>) {
  const calls: string[] = [];
  const bus = {
    name: ':1.99',
    call: (m: { member: string; path?: string; body?: unknown[] }) => {
      calls.push(m.member);
      const node = tree[m.path ?? ''];
      if (m.member === 'GetAddress') return Promise.resolve({ body: ['unix:path=/tmp/fake'] });
      if (m.member === 'RegisterEvent' || m.member === 'AddMatch') {
        return Promise.resolve({ body: [] });
      }
      if (m.member === 'GetRegisteredEvents') {
        return Promise.resolve({ body: [[[':1.99', 'Window:Activate:']]] });
      }
      if (m.member === 'GetRoleName') return Promise.resolve({ body: [node?.role ?? 'unknown'] });
      if (m.member === 'GetChildren') {
        return Promise.resolve({ body: [(node?.reported ?? []).map((c) => [':1.5', c])] });
      }
      if (m.member === 'Get' && m.body?.[1] === 'ChildCount') {
        return Promise.resolve({ body: [new dbus.Variant('i', node?.actual.length ?? 0)] });
      }
      if (m.member === 'GetChildAtIndex') {
        const child = node?.actual[m.body?.[0] as number];
        return Promise.resolve({ body: [child ? [':1.5', child] : ['', '']] });
      }
      if (m.member === 'GetText') return Promise.resolve({ body: [node?.text ?? ''] });
      return Promise.resolve({ body: [] });
    },
    on: () => undefined,
    disconnect: () => undefined,
  };
  return { bus: bus as unknown as dbus.MessageBus, calls };
}

async function started(fake: ReturnType<typeof fakeBus>): Promise<AtspiClient> {
  vi.spyOn(dbus, 'sessionBus').mockReturnValue(fake.bus);
  const client = new AtspiClient({ onWindowActivated: () => undefined });
  await client.start();
  return client;
}

describe('findAddressBarPath — a node that under-reports its children', () => {
  it('reaches an address bar GetChildren leaves out', async () => {
    const fake = fakeBus(firefoxTree());
    const client = await started(fake);

    await expect(client.findAddressBarPath(':1.5', '/win')).resolves.toBe('/combo');

    client.stop();
    vi.restoreAllMocks();
  });

  it('asks for the children it was not told about', async () => {
    const fake = fakeBus(firefoxTree());
    const client = await started(fake);

    await client.findAddressBarPath(':1.5', '/win');

    expect(fake.calls).toContain('GetChildAtIndex');
    client.stop();
    vi.restoreAllMocks();
  });

  // The extra property read must not become an extra round trip everywhere.
  it('does not enumerate when GetChildren is already complete', async () => {
    const complete: Record<string, Node> = {
      '/win': { role: 'frame', reported: ['/bar'], actual: ['/bar'] },
      '/bar': { role: 'tool bar', reported: ['/entry'], actual: ['/entry'] },
      '/entry': { role: 'entry', reported: [], actual: [], text: 'example.com' },
    };
    const fake = fakeBus(complete);
    const client = await started(fake);

    await expect(client.findAddressBarPath(':1.5', '/win')).resolves.toBe('/entry');

    expect(fake.calls).not.toContain('GetChildAtIndex');
    client.stop();
    vi.restoreAllMocks();
  });
});
