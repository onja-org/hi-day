#!/usr/bin/env node
// Publishes win-resolver.exe for packaging (dist:win, build:resolver:win).
//
// Empties the publish folder first. With the .NET 10 SDK (seen on 10.0.401),
// a second `dotnet publish` into an existing publish folder leaves only
// win-resolver.exe and its .pdb: browser-registry.json,
// firefox-private-markers.json and the WPF native DLLs are deleted and not
// copied back. Without the JSON files, URL tracking never starts. Any re-run in
// the same worktree hit this, so beforePack refused to package. Deleting the
// publish folder alone is enough; bin/ and obj/ can stay for incremental
// builds.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../native/win/resolver/WinResolver',
);

rmSync(path.join(projectDir, 'bin/Release/net8.0-windows/win-x64/publish'), {
  recursive: true,
  force: true,
});

const result = spawnSync(
  'dotnet',
  [
    'publish',
    path.join(projectDir, 'WinResolver.csproj'),
    '-c',
    'Release',
    '-r',
    'win-x64',
    '--self-contained',
    '-p:PublishSingleFile=true',
  ],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error(`Could not run dotnet: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
