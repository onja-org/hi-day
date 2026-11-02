import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberedServerUrl } from '../setup-state';
import { ServerUrlSetting } from '../server-url';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hiday-server-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function setting({
  packaged = true,
  env = {},
  answers = true,
} = {}) {
  const probe = vi.fn().mockResolvedValue(answers);
  return {
    subject: new ServerUrlSetting(dir, packaged, env, probe),
    probe,
  };
}

describe('what the login screen is told', () => {
  it('offers Hi Day Cloud to a packaged app that has chosen nothing', () => {
    expect(setting().subject.state()).toEqual({
      url: 'https://api.hiday.io',
      isDefault: true,
      canEdit: true,
    });
  });

  it('offers localhost to a dev build', () => {
    expect(setting({ packaged: false }).subject.state().url).toBe(
      'http://localhost:3001',
    );
  });

  it('offers the chosen server once there is one', async () => {
    const { subject } = setting();

    await subject.save('https://hiday.acme.example');

    expect(subject.state()).toEqual({
      url: 'https://hiday.acme.example',
      isDefault: false,
      canEdit: true,
    });
  });

  /**
   * Shown read-only rather than hidden, so a developer wondering why their
   * edit does nothing can see the reason.
   */
  it('is read-only where DESKTOP_API_URL is set', () => {
    const { subject } = setting({
      env: { DESKTOP_API_URL: 'https://staging.example.test' },
    });

    expect(subject.state()).toEqual({
      url: 'https://staging.example.test',
      isDefault: false,
      canEdit: false,
    });
  });
});

describe('saving a server address', () => {
  it('remembers a reachable one', async () => {
    const { subject } = setting();

    await expect(subject.save('https://hiday.acme.example')).resolves.toEqual({
      ok: true,
      url: 'https://hiday.acme.example',
    });
    expect(rememberedServerUrl(dir)).toBe('https://hiday.acme.example');
  });

  it('normalises before saving, so a trailing slash cannot double up', async () => {
    const { subject } = setting();

    await subject.save('  https://hiday.acme.example/  ');

    expect(rememberedServerUrl(dir)).toBe('https://hiday.acme.example');
  });

  /**
   * Nothing is written on a failure: a typo must leave the working address
   * in place rather than stranding the app somewhere unreachable.
   */
  it('saves nothing when the address is invalid', async () => {
    const { subject, probe } = setting();

    const result = await subject.save('not-a-url');

    expect(result.ok).toBe(false);
    expect(rememberedServerUrl(dir)).toBeNull();
    // Not even asked — there is nothing to ask.
    expect(probe).not.toHaveBeenCalled();
  });

  it('saves nothing when plain http points at the internet', async () => {
    const { subject } = setting();

    const result = await subject.save('http://hiday.acme.example');

    expect(result.message).toMatch(/use https/i);
    expect(rememberedServerUrl(dir)).toBeNull();
  });

  /**
   * The next thing after saving is a pairing flow that opens a browser.
   * "Could not reach that server" said now beats a pairing that silently
   * never completes.
   */
  it('saves nothing when no server answers', async () => {
    const { subject } = setting({ answers: false });

    const result = await subject.save('https://typo.acme.example');

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not reach/i);
    expect(rememberedServerUrl(dir)).toBeNull();
  });

  it('keeps the previous address when a new one fails', async () => {
    const { subject } = setting();
    await subject.save('https://good.acme.example');

    const { subject: failing } = (() => {
      const probe = vi.fn().mockResolvedValue(false);
      return { subject: new ServerUrlSetting(dir, true, {}, probe) };
    })();
    const result = await failing.save('https://typo.acme.example');

    expect(result.url).toBe('https://good.acme.example');
    expect(rememberedServerUrl(dir)).toBe('https://good.acme.example');
  });

  it('refuses to save while DESKTOP_API_URL is in charge', async () => {
    const { subject, probe } = setting({
      env: { DESKTOP_API_URL: 'https://staging.example.test' },
    });

    const result = await subject.save('https://hiday.acme.example');

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/DESKTOP_API_URL/);
    expect(probe).not.toHaveBeenCalled();
    expect(rememberedServerUrl(dir)).toBeNull();
  });

  // Asks the one unguarded endpoint, so a 200 means a Hi Day server that is
  // genuinely serving rather than merely something listening on the port.
  it('probes the address it is about to save, normalised', async () => {
    const { subject, probe } = setting();

    await subject.save('https://hiday.acme.example/');

    expect(probe).toHaveBeenCalledWith('https://hiday.acme.example');
  });
});

describe('resetting', () => {
  it('hands control back to the built-in default', async () => {
    const { subject } = setting();
    await subject.save('https://hiday.acme.example');

    expect(subject.reset()).toEqual({
      url: 'https://api.hiday.io',
      isDefault: true,
      canEdit: true,
    });
    expect(rememberedServerUrl(dir)).toBeNull();
  });
});
