import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Must match electron-builder.yml's linux.executableName.
const EXECUTABLE_NAME = 'workforce-monitor';

/**
 * Linux only. Electron's sandbox needs either a setuid chrome-sandbox
 * helper or working unprivileged user namespaces, and AppArmor-restricted
 * distros (Ubuntu 23.10+) block the latter for any app without its own
 * AppArmor profile — so a plain `apt install` fails to even start, with a
 * FATAL "SUID sandbox helper... not configured correctly" error.
 * --no-sandbox fixes it, but Electron's native startup reads that switch
 * too early for app.commandLine.appendSwitch() or the
 * ELECTRON_DISABLE_SANDBOX env var (set from within our own JS, after the
 * electron module has already initialized) to take effect — it has to be
 * a genuine CLI argument at exec() time, before Node/Electron's JS runs at
 * all. So the packaged binary becomes a tiny wrapper script that execs the
 * real Electron binary with --no-sandbox appended, covering both the
 * desktop launcher (.desktop Exec=) and running the command directly from
 * a terminal.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
export default function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const appOutDir = context.appOutDir;
  const realBinaryName = `${EXECUTABLE_NAME}-bin`;

  renameSync(join(appOutDir, EXECUTABLE_NAME), join(appOutDir, realBinaryName));

  const wrapperScript = `#!/bin/sh\nexec "$(dirname "$0")/${realBinaryName}" --no-sandbox "$@"\n`;
  writeFileSync(join(appOutDir, EXECUTABLE_NAME), wrapperScript, {
    mode: 0o755,
  });
}
