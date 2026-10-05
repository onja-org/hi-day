import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  missingArchitectures,
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
