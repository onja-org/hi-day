import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerLog } from '../timer-log';

describe('TimerLog', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'timer-log-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes one line per event, with its time, name and details', () => {
    const log = new TimerLog(dir, () => new Date('2026-11-25T15:12:07.000Z'));

    log.write('queued', { type: 'stop', opId: 'op1', entryId: 'e1' });
    log.write('refused', { opId: 'op1', status: 404, message: 'No timer' });

    const lines = readFileSync(join(dir, 'logs', 'timer.log'), 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({
      at: '2026-11-25T15:12:07.000Z',
      event: 'queued',
      type: 'stop',
      opId: 'op1',
      entryId: 'e1',
    });
    expect(JSON.parse(lines[1])).toMatchObject({ event: 'refused', status: 404 });
  });

  it('keeps its own time even when an event carries a field of the same name', () => {
    const log = new TimerLog(dir, () => new Date('2026-11-26T10:00:35.000Z'));

    log.write('sent', { at: '2026-11-26T09:56:26.878Z', event: 'other' });

    const line = JSON.parse(readFileSync(join(dir, 'logs', 'timer.log'), 'utf-8')) as Record<string, unknown>;
    expect(line.at).toBe('2026-11-26T10:00:35.000Z');
    expect(line.event).toBe('sent');
  });

  it('starts a new file once the current one is full, keeping one old one', () => {
    const log = new TimerLog(dir, () => new Date(), 200);

    for (let i = 0; i < 20; i += 1) log.write('sent', { opId: `op${i}`, verdict: 'accepted' });

    expect(statSync(join(dir, 'logs', 'timer.log')).size).toBeLessThanOrEqual(400);
    expect(existsSync(join(dir, 'logs', 'timer.log.1'))).toBe(true);
    expect(readFileSync(join(dir, 'logs', 'timer.log'), 'utf-8')).toContain('op19');
  });

  it('never throws: a log that cannot be written must not stop the timer', () => {
    const log = new TimerLog(join(dir, 'missing', '\0bad'));
    expect(() => log.write('queued', { opId: 'op1' })).not.toThrow();
  });
});
