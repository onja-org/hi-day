import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OsascriptRunner } from '../osascript-runner';
import { PermissionProbe } from '../permission-probe';

const fakeOsascriptPath = join(__dirname, 'fake-osascript.mjs');

function makeProbe(): PermissionProbe {
  return new PermissionProbe(new OsascriptRunner({ command: fakeOsascriptPath }));
}

describe('PermissionProbe', () => {
  it('reports granted when the probe Apple Event succeeds', async () => {
    const probe = makeProbe();
    expect(await probe.probeAutomation('Google Chrome')).toEqual({ state: 'granted' });
  });

  it('reports denied on a TCC consent-denied response', async () => {
    const probe = makeProbe();
    expect(await probe.probeAutomation('Denied Browser')).toEqual({ state: 'denied' });
  });

  it('reports indeterminate (not a false grant or deny) when the target is not running', async () => {
    const probe = makeProbe();
    const result = await probe.probeAutomation('Not Running Browser');
    expect(result.state).toBe('indeterminate');
  });
});
