import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  registerAppImageSchemeHandler,
  schemeHandlerFilePath,
} from '../linux-scheme-handler';

describe('registerAppImageSchemeHandler', () => {
  let dataHome: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dataHome = mkdtempSync(join(tmpdir(), 'hiday-scheme-'));
    env = { XDG_DATA_HOME: dataHome, APPIMAGE: '/home/someone/Hi Day.AppImage' };
  });

  afterEach(() => {
    rmSync(dataHome, { recursive: true, force: true });
  });

  it('writes nothing outside an AppImage, where the .deb entry already claims the scheme', () => {
    const directory = registerAppImageSchemeHandler('hiday', {
      XDG_DATA_HOME: dataHome,
    });

    expect(directory).toBeNull();
    expect(existsSync(schemeHandlerFilePath({ XDG_DATA_HOME: dataHome }))).toBe(
      false,
    );
  });

  it('claims the scheme for the stable $APPIMAGE path, passing the URL through', () => {
    const directory = registerAppImageSchemeHandler('hiday', env);

    expect(directory).toBe(join(dataHome, 'applications'));
    const entry = readFileSync(schemeHandlerFilePath(env), 'utf-8');
    expect(entry).toContain('MimeType=x-scheme-handler/hiday;');
    expect(entry).toContain('Exec="/home/someone/Hi Day.AppImage" --no-sandbox %U');
  });

  it('reports nothing to re-index when the entry is already right', () => {
    registerAppImageSchemeHandler('hiday', env);

    expect(registerAppImageSchemeHandler('hiday', env)).toBeNull();
  });

  it('rewrites the entry after a self-update moves the AppImage', () => {
    registerAppImageSchemeHandler('hiday', env);

    const moved = { ...env, APPIMAGE: '/home/someone/Downloads/Hi Day.AppImage' };
    expect(registerAppImageSchemeHandler('hiday', moved)).not.toBeNull();
    expect(readFileSync(schemeHandlerFilePath(moved), 'utf-8')).toContain(
      'Exec="/home/someone/Downloads/Hi Day.AppImage"',
    );
  });
});
