import { appendFileSync } from 'node:fs';

/**
 * One resolver reading, as recorded for offline debugging (Step 6 of
 * docs/url-tracking-plan.md). `normalized` and `decision` aren't populated by
 * anything in Stage A — they're filled in once the normalization pipeline and
 * session engine exist to produce them; until then callers simply omit them.
 */
export interface DebugRecord {
  ts: number;
  raw: string;
  normalized?: string;
  source: string;
  confidence: string;
  latencyMs: number;
  decision?: string;
}

export interface DebugSink {
  record(entry: DebugRecord): void;
}

/**
 * Opt-in JSONL sink — one `DebugRecord` per line, appended to `filePath`.
 * Whether it's enabled at all is the caller's decision (e.g. an env var or
 * settings flag); this class only knows how to write records when asked.
 */
export class DebugHarness implements DebugSink {
  constructor(private readonly filePath: string) {}

  record(entry: DebugRecord): void {
    appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }
}

/** A harness that discards every record — the default when debug mode is off. */
export class NullDebugHarness implements DebugSink {
  record(entry: DebugRecord): void {
    void entry; // intentionally discarded
  }
}
