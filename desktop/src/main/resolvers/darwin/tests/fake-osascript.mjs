#!/usr/bin/env node
// A stand-in for the real `osascript` binary (which doesn't exist off
// macOS) — OsascriptRunner's `command` option is overridable specifically
// so tests can point it here instead. Behavior is chosen by substring in
// the "script path" argument, same spirit as mock-resolver.mjs in
// url-capture/tests/.
const scriptPath = process.argv[2] ?? '';
const rest = process.argv.slice(3);

if (scriptPath.includes('succeed')) {
  process.stdout.write(`https://example.com/page\tExample Page\tnormal\n`);
  if (rest.length > 0) process.stderr.write(`args: ${rest.join(',')}\n`);
  process.exit(0);
} else if (scriptPath.includes('fail-not-running')) {
  process.stderr.write('12:20: execution error: not-running\n');
  process.exit(1);
} else if (scriptPath.includes('hang')) {
  // Deliberately never exits — exercises the runner's own timeout/SIGKILL.
  // An empty body wouldn't do this: with no listeners or timers keeping it
  // alive, Node's event loop just drains and the process exits on its own.
  setInterval(() => undefined, 60_000);
} else if (scriptPath.includes('permission-probe')) {
  // permission-probe.ts's materialized script is a real, fixed path (not a
  // test-chosen fixture name) — behavior is selected by the app-name
  // argument instead, mirroring what the real script's outcomes depend on.
  const appName = rest[0] ?? '';
  if (appName === 'Denied Browser') {
    process.stderr.write('31:41: execution error: Not authorized to send Apple events to Denied Browser. (-1743)\n');
    process.exit(1);
  } else if (appName === 'Not Running Browser') {
    process.stderr.write('12:20: execution error: not-running\n');
    process.exit(1);
  } else {
    process.stdout.write('ok\n');
    process.exit(0);
  }
} else {
  process.stderr.write('unrecognized fixture scenario\n');
  process.exit(1);
}
