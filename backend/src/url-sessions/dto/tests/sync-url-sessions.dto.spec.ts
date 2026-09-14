import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SyncUrlSessionsDto } from '../sync-url-sessions.dto';

/** A session exactly as the desktop agent's local store produces one. */
function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b54d3085-d74c-4ae3-b057-3bb26fd15de5',
    url: 'https://mail.google.com/mail/u/0/',
    host: 'mail.google.com',
    path: '/mail/u/0/',
    title: 'Inbox',
    browser: 'chrome',
    private: null,
    deviceId: '4784687e-51a3-424a-beb6-cf56f69ae406',
    startedAt: 1789047156861,
    endedAt: 1789047179035,
    activeMs: 22161,
    tzOffsetMin: 0,
    source: 'atspi',
    confidence: 'displayed',
    ...overrides,
  };
}

function validate(body: unknown) {
  return validateSync(plainToInstance(SyncUrlSessionsDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('SyncUrlSessionsDto', () => {
  it('accepts a real captured session from the desktop store', () => {
    expect(validate({ sessions: [session()] })).toHaveLength(0);
  });

  it('rejects a fractional activeMs — the bug that silently blocked every sync', () => {
    // The session engine accumulates monotonic-clock deltas, so activeMs was
    // reaching the wire as e.g. 2104.5833219999986. @IsInt rejected it, the
    // endpoint 400'd, and capture looked broken end-to-end while actually
    // working. The client now rounds; this pins the contract so a regression
    // there fails here rather than in the field.
    const errors = validate({
      sessions: [session({ activeMs: 2104.5833219999986 })],
    });
    expect(errors).toHaveLength(1);
    const constraints = errors[0].children?.[0]?.children?.flatMap((c) =>
      Object.keys(c.constraints ?? {}),
    );
    expect(constraints).toContain('isInt');
  });

  it('accepts private: null for a browser with no incognito signal', () => {
    expect(validate({ sessions: [session({ private: null })] })).toHaveLength(
      0,
    );
  });

  it('rejects an empty batch', () => {
    expect(validate({ sessions: [] }).length).toBeGreaterThan(0);
  });
});
