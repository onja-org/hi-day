import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  missingArchitectures,
  missingDataFiles,
  requirementFor,
} from '../../../scripts/beforePack.mjs';

describe('requirementFor', () => {
  it('requires nothing on linux, whose resolver is compiled into dist/', () => {
    expect(requirementFor('linux')).toBeNull();
  });

  it('points win32 at the repo root, not at desktop/', () => {
    const required = requirementFor('win32');
    // The Windows resolver lives at the repo root while the darwin helper lives
    // under desktop/. electron-builder's extraResources entry got this wrong and
    // would have bundled nothing, so the asymmetry is worth asserting.
    expect(required?.path).toContain(join('native', 'win', 'resolver'));
    expect(required?.path).not.toContain(join('desktop', 'native', 'win'));
    expect(required?.path.endsWith('win-resolver.exe')).toBe(true);
  });

  it('points darwin under desktop/, where the helper is built', () => {
    const required = requirementFor('darwin');
    expect(required?.path).toContain(join('desktop', 'native', 'darwin'));
    expect(required?.path.endsWith('firefox-ax-helper')).toBe(true);
  });

  it('names the command that builds each side-car', () => {
    expect(requirementFor('win32')?.build).toContain('build:resolver:win');
    expect(requirementFor('darwin')?.build).toContain('build:resolver:mac');
  });

  it('requires the two JSON files the Windows resolver reads at startup', () => {
    // v0.3.7 shipped a Windows publish output holding the .exe and neither of
    // these. The resolver threw FileNotFoundException before answering a single
    // request, so no Windows machine on that version recorded a URL.
    expect(requirementFor('win32')?.alongside).toEqual([
      'browser-registry.json',
      'firefox-private-markers.json',
    ]);
  });

  it('requires nothing beside the darwin helper, which reads no file of its own', () => {
    expect(requirementFor('darwin')?.alongside).toEqual([]);
  });
});

describe('missingDataFiles', () => {
  const made: string[] = [];

  /** A publish directory holding `present`, with the side-car binary in it. */
  function publishDir(present: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'before-pack-'));
    made.push(dir);
    writeFileSync(join(dir, 'win-resolver.exe'), '');
    for (const file of present) writeFileSync(join(dir, file), '{}');
    return dir;
  }

  afterAll(() => {
    for (const dir of made) rmSync(dir, { recursive: true, force: true });
  });

  const alongside = ['browser-registry.json', 'firefox-private-markers.json'];

  it('accepts a publish output holding every data file', () => {
    const dir = publishDir(alongside);
    expect(
      missingDataFiles({ path: join(dir, 'win-resolver.exe'), alongside }),
    ).toEqual([]);
  });

  it('names both files when the output has the binary alone', () => {
    // Exactly what v0.3.7's Windows build produced, and what this guard now
    // refuses to package.
    const dir = publishDir([]);
    expect(
      missingDataFiles({ path: join(dir, 'win-resolver.exe'), alongside }),
    ).toEqual(alongside);
  });

  it('names only the file that is absent in a half-copied output', () => {
    const dir = publishDir(['browser-registry.json']);
    expect(
      missingDataFiles({ path: join(dir, 'win-resolver.exe'), alongside }),
    ).toEqual(['firefox-private-markers.json']);
  });

  it('asks nothing of a side-car that requires no data file', () => {
    const dir = publishDir([]);
    expect(
      missingDataFiles({ path: join(dir, 'win-resolver.exe'), alongside: [] }),
    ).toEqual([]);
  });
});

describe('missingArchitectures', () => {
  it('accepts a universal binary', () => {
    expect(
      missingArchitectures(
        'Architectures in the fat file: firefox-ax-helper are: x86_64 arm64',
      ),
    ).toEqual([]);
  });

  it('rejects the single-slice output --native produces', () => {
    // Verbatim from the build that was nearly shipped: an Intel-only helper
    // goes into the arm64 dmg too, silently breaking Firefox tracking on every
    // Apple Silicon Mac.
    expect(
      missingArchitectures(
        'Non-fat file: desktop/native/darwin/firefox-ax-helper is architecture: x86_64',
      ),
    ).toEqual(['arm64']);
  });

  it('rejects an arm64-only binary too', () => {
    expect(
      missingArchitectures('Non-fat file: firefox-ax-helper is architecture: arm64'),
    ).toEqual(['x86_64']);
  });
});
