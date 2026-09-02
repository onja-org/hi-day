import { LoginAttemptTracker } from '../login-attempt-tracker.service';

describe('LoginAttemptTracker', () => {
  it('does not require a captcha before any failures', () => {
    const tracker = new LoginAttemptTracker();

    expect(tracker.requiresCaptcha('jane@acme.test')).toBe(false);
  });

  it('requires a captcha once the failure count reaches the threshold', () => {
    const tracker = new LoginAttemptTracker();

    for (let i = 0; i < 4; i++) {
      tracker.recordFailure('jane@acme.test');
    }
    expect(tracker.requiresCaptcha('jane@acme.test')).toBe(false);

    tracker.recordFailure('jane@acme.test');
    expect(tracker.requiresCaptcha('jane@acme.test')).toBe(true);
  });

  it('tracks failures per email independently', () => {
    const tracker = new LoginAttemptTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure('jane@acme.test');
    }

    expect(tracker.requiresCaptcha('jane@acme.test')).toBe(true);
    expect(tracker.requiresCaptcha('other@acme.test')).toBe(false);
  });

  it('normalizes email casing and surrounding whitespace to the same key', () => {
    const tracker = new LoginAttemptTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure('  Jane@Acme.test  ');
    }

    expect(tracker.requiresCaptcha('jane@acme.test')).toBe(true);
  });

  it('forgets failures once the 15-minute window has passed', () => {
    jest.useFakeTimers();
    try {
      const tracker = new LoginAttemptTracker();

      for (let i = 0; i < 5; i++) {
        tracker.recordFailure('jane@acme.test');
      }
      expect(tracker.requiresCaptcha('jane@acme.test')).toBe(true);

      jest.advanceTimersByTime(15 * 60 * 1000 + 1);

      expect(tracker.requiresCaptcha('jane@acme.test')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reset clears the failure count', () => {
    const tracker = new LoginAttemptTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure('jane@acme.test');
    }
    tracker.reset('jane@acme.test');

    expect(tracker.requiresCaptcha('jane@acme.test')).toBe(false);
  });
});
