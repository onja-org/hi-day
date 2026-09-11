import { spawn } from 'node:child_process';

export interface SpawnWithTimeoutResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Set only when the process could not be spawned at all (e.g. ENOENT). */
  spawnError?: string;
}

/** Shared by osascript-runner.ts and firefox-ax.ts — both just shell out and wait, bounded by a deadline. */
export function spawnWithTimeout(command: string, args: string[], timeoutMs: number): Promise<SpawnWithTimeoutResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: null, stdout, stderr, timedOut: false, spawnError: err.message });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ exitCode: code, stdout, stderr, timedOut });
    });
  });
}
