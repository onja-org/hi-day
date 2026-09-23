import { describe, expect, it, vi } from 'vitest';
import dbus from 'dbus-next';
import { AtspiClient } from '../atspi';

/**
 * The tree walk costs one D-Bus round trip per node, and the heartbeat
 * resolves the same window every 5 seconds. Measured on a real session:
 * 625ms per sweep of the open windows, of which 572ms was gnome-shell —
 * a window with no address bar at all, whose full walk was repeated every
 * time because a miss left nothing to remember. On a slower machine that
 * exhausted the manager's 2s request timeout and no URL was recorded.
 */

/** A window holding a tool bar with one readable entry, plus filler to make the walk measurable. */
function browserTree(): Record<string, { role: string; children: string[]; text?: string }> {
  return {
    '/win': { role: 'frame', children: ['/filler1', '/bar'] },
    '/filler1': { role: 'panel', children: ['/filler2'] },
    '/filler2': { role: 'panel', children: [] },
    '/bar': { role: 'tool bar', children: ['/entry'] },
    '/entry': { role: 'entry', children: [], text: 'example.com' },
  };
}

/** No tool bar anywhere — the expensive case, which must be walked in full to prove a negative. */
function noAddressBarTree(): Record<string, { role: string; children: string[]; text?: string }> {
  return {
    '/win': { role: 'frame', children: ['/a', '/b'] },
    '/a': { role: 'panel', children: ['/a1'] },
    '/a1': { role: 'panel', children: [] },
    '/b': { role: 'panel', children: [] },
  };
}

function fakeBus(tree: Record<string, { role: string; children: string[]; text?: string }>) {
  const calls = { total: 0 };
  const bus = {
    name: ':1.99',
    call: (m: { member: string; path?: string; signature?: string }) => {
      calls.total += 1;
      const node = tree[m.path ?? ''];
      if (m.member === 'GetAddress') return Promise.resolve({ body: ['unix:path=/tmp/fake'] });
      if (m.member === 'RegisterEvent' || m.member === 'AddMatch') return Promise.resolve({ body: [] });
      if (m.member === 'GetRegisteredEvents') return Promise.resolve({ body: [[[':1.99', 'Window:Activate:']]] });
      if (m.member === 'GetRoleName') return Promise.resolve({ body: [node?.role ?? 'unknown'] });
      if (m.member === 'GetChildren') {
        return Promise.resolve({ body: [(node?.children ?? []).map((c) => [':1.5', c])] });
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

describe('findAddressBarPath — remembering where a window keeps its address bar', () => {
  it('returns the same path without walking the tree again', async () => {
    const fake = fakeBus(browserTree());
    const client = await started(fake);

    const first = await client.findAddressBarPath(':1.5', '/win');
    const afterFirst = fake.calls.total;
    const second = await client.findAddressBarPath(':1.5', '/win');

    expect(second).toBe(first);
    // One round trip to confirm the remembered node is still an address bar.
    expect(fake.calls.total - afterFirst).toBe(1);
    client.stop();
    vi.restoreAllMocks();
  });

  it('walks again when the remembered node is no longer an address bar', async () => {
    const tree = browserTree();
    const fake = fakeBus(tree);
    const client = await started(fake);

    await client.findAddressBarPath(':1.5', '/win');
    tree['/entry'].role = 'panel'; // window re-laid out under us
    const afterFirst = fake.calls.total;
    await client.findAddressBarPath(':1.5', '/win');

    expect(fake.calls.total - afterFirst).toBeGreaterThan(1);
    client.stop();
    vi.restoreAllMocks();
  });

  /** The case that actually caused the timeouts. */
  it('does not re-walk a window already found to have no address bar', async () => {
    const fake = fakeBus(noAddressBarTree());
    const client = await started(fake);

    expect(await client.findAddressBarPath(':1.5', '/win')).toBeNull();
    const afterFirst = fake.calls.total;
    expect(await client.findAddressBarPath(':1.5', '/win')).toBeNull();

    expect(fake.calls.total).toBe(afterFirst);
    client.stop();
    vi.restoreAllMocks();
  });

  it('keeps each window separate, so one window\'s bar is never served for another', async () => {
    const fake = fakeBus({ ...browserTree(), '/win2': { role: 'frame', children: ['/bar'] } });
    const client = await started(fake);

    const one = await client.findAddressBarPath(':1.5', '/win');
    const two = await client.findAddressBarPath(':1.6', '/win');

    expect(one).toBe('/entry');
    expect(two).toBe('/entry');
    client.stop();
    vi.restoreAllMocks();
  });
});
