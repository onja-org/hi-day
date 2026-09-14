#!/usr/bin/env node
// A fixture-driven fake side-car, spawned as a real child process by
// resolver-manager.spec.ts so the manager's actual stdio/line-framing/timeout
// code paths get exercised — not mocked around. Plain JS on purpose: it's a
// test-only harness, not part of the shipped app, so it needs no build step
// and no compiled-.ts round trip for `pnpm test` to run standalone.
//
// Fixture shape:
// {
//   "ready": { "platform": "mock", "caps": ["focus", "url"] } | null,
//   "crashAfterMs": 50,                     // exits(1) unconditionally after this many ms
//   "rules": [
//     { "op": "resolve" | "ping",
//       "action": "respond" | "error" | "hang" | "crash" | "raw" | "partial" | "oversized",
//       "delayMs": 0,                       // respond/error/raw/crash only
//       "response": { ...ResolveOkResponse fields minus id/ok },  // respond
//       "message": "...",                   // error
//       "raw": "not json\n",                // raw
//       "firstChunk": "...", "restChunk": "...", "gapMs": 50,     // partial
//       "sizeBytes": 50000, "fillChar": "x"  // oversized
//     }
//   ],
//   "events": [ { "afterMs": 100, "event": { "ev": "focus", ... } } ]
// }
//
// Rules are consumed in order, per `op` — the Nth `resolve` request matches
// the Nth `resolve` rule. A request past the last matching rule gets a
// harmless default ack so an under-specified fixture doesn't hang a test.

import { readFileSync } from 'node:fs';

const fixturePath = process.argv[2];
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const ruleCursorByOp = new Map();

function nextRule(op) {
  const cursor = ruleCursorByOp.get(op) ?? 0;
  const rulesForOp = (fixture.rules ?? []).filter((rule) => rule.op === op);
  ruleCursorByOp.set(op, cursor + 1);
  return rulesForOp[cursor];
}

function writeLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function after(delayMs, fn) {
  if (delayMs) {
    setTimeout(fn, delayMs);
  } else {
    fn();
  }
}

if (fixture.ready) {
  writeLine({ ev: 'ready', ...fixture.ready });
}

if (typeof fixture.crashAfterMs === 'number') {
  setTimeout(() => process.exit(1), fixture.crashAfterMs);
}

for (const scheduled of fixture.events ?? []) {
  setTimeout(() => writeLine(scheduled.event), scheduled.afterMs);
}

function handleRequest(request) {
  const { id, op } = request;
  const rule = nextRule(op);

  if (!rule) {
    writeLine({ id, ok: true });
    return;
  }

  switch (rule.action) {
    case 'respond':
      after(rule.delayMs, () => writeLine({ id, ok: true, ...(rule.response ?? {}) }));
      break;
    case 'error':
      after(rule.delayMs, () => writeLine({ id, ok: false, message: rule.message ?? 'mock error' }));
      break;
    case 'hang':
      break; // never respond — drives timeout / watchdog-miss tests
    case 'crash':
      after(rule.delayMs, () => process.exit(1));
      break;
    case 'raw':
      after(rule.delayMs, () => process.stdout.write(rule.raw ?? ''));
      break;
    case 'partial':
      process.stdout.write(rule.firstChunk ?? '');
      setTimeout(() => process.stdout.write(rule.restChunk ?? ''), rule.gapMs ?? 50);
      break;
    case 'oversized':
      process.stdout.write((rule.fillChar ?? 'x').repeat(rule.sizeBytes ?? 2_000_000));
      break;
    default:
      writeLine({ id, ok: true });
  }
}

let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf('\n');
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex);
    buffer = buffer.slice(newlineIndex + 1);
    if (line.trim().length > 0) {
      try {
        handleRequest(JSON.parse(line));
      } catch {
        // Malformed input from the manager isn't expected in these fixtures;
        // ignore rather than crash the harness itself.
      }
    }
    newlineIndex = buffer.indexOf('\n');
  }
});
