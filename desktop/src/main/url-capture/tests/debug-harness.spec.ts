import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DebugHarness, NullDebugHarness, type DebugRecord } from '../debug-harness';

describe('DebugHarness', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'debug-harness-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('appends one JSON line per record', () => {
    const filePath = join(dir, 'debug.jsonl');
    const harness = new DebugHarness(filePath);
    const first: DebugRecord = { ts: 1, raw: 'chrome.exe: github.com', source: 'uia', confidence: 'displayed', latencyMs: 12 };
    const second: DebugRecord = { ts: 2, raw: 'example.com', source: 'apple-events', confidence: 'exact', latencyMs: 4 };

    harness.record(first);
    harness.record(second);

    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(first);
    expect(JSON.parse(lines[1])).toEqual(second);
  });
});

describe('NullDebugHarness', () => {
  it('is a no-op sink', () => {
    const harness = new NullDebugHarness();
    expect(() => harness.record({ ts: 1, raw: 'x', source: 'title', confidence: 'guess', latencyMs: 1 })).not.toThrow();
  });
});
