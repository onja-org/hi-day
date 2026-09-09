#!/usr/bin/env node
// Stand-in for the compiled Swift firefox-ax-helper binary, which only
// exists on macOS. FirefoxAxResolver's binaryPath is overridable specifically
// so tests can point it here. Since `resolve` only ever varies by pid, the
// pid itself selects the scenario — same spirit as fake-osascript.mjs
// selecting behavior from its scriptPath argument.
const [, , command, pidArg] = process.argv;

function printJSON(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (command === 'check-permission') {
  printJSON({ granted: true });
  process.exit(0);
} else if (command === 'resolve') {
  const scenario = Number(pidArg);
  switch (scenario) {
    case 1:
      printJSON({ ok: true, value: 'https://example.com/page', title: 'Example Page — Mozilla Firefox' });
      process.exit(0);
      break;
    case 2:
      printJSON({
        ok: true,
        value: 'https://example.com/page',
        title: 'Example Page — Mozilla Firefox (Private Browsing)',
      });
      process.exit(0);
      break;
    case 3:
      printJSON({ ok: false, code: 'permission-denied', message: 'Accessibility permission has not been granted.' });
      process.exit(1);
      break;
    case 4:
      printJSON({ ok: false, code: 'no-window', message: 'Firefox has no focused window.' });
      process.exit(1);
      break;
    case 5:
      // Hangs deliberately — exercises the timeout path. An empty branch
      // wouldn't do this; keep the event loop alive with a real timer.
      setInterval(() => undefined, 60_000);
      break;
    case 6:
      process.stdout.write('not json at all\n');
      process.exit(0);
      break;
    default:
      process.exit(1);
  }
} else {
  process.exit(1);
}
