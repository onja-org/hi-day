import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OsascriptRunner } from '../osascript-runner';

const fakeOsascriptPath = join(__dirname, 'fake-osascript.mjs');

function makeRunner(timeoutMs?: number): OsascriptRunner {
  return new OsascriptRunner({ command: fakeOsascriptPath, timeoutMs });
}

describe('OsascriptRunner', () => {
  it('returns stdout on a successful run', async () => {
    const runner = makeRunner();
    const result = await runner.run('/tmp/succeed.applescript', ['Google Chrome']);
    expect(result).toEqual({ ok: true, stdout: 'https://example.com/page\tExample Page\tnormal\n' });
  });

  it('classifies a non-zero exit via stderr', async () => {
    const runner = makeRunner();
    const result = await runner.run('/tmp/fail-not-running.applescript');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not-running');
  });

  it('times out and kills a hanging process', async () => {
    const runner = makeRunner(150);
    const result = await runner.run('/tmp/hang.applescript');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('timeout');
  });

  it('bounds concurrency: a second call while one is in flight is rejected as busy', async () => {
    const runner = makeRunner(2_000);
    const first = runner.run('/tmp/succeed.applescript');
    const second = runner.run('/tmp/succeed.applescript');

    const [firstResult, secondResult] = await Promise.all([first, second]);
    const results = [firstResult, secondResult];
    const busyCount = results.filter((r) => !r.ok && r.error.code === 'busy').length;
    const okCount = results.filter((r) => r.ok).length;

    expect(busyCount).toBe(1);
    expect(okCount).toBe(1);
  });

  it('allows a fresh call after the previous one completes', async () => {
    const runner = makeRunner();
    const first = await runner.run('/tmp/succeed.applescript');
    const second = await runner.run('/tmp/succeed.applescript');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });
});
