import { Injectable } from '@nestjs/common';

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const CAPTCHA_REQUIRED_AFTER = 5;

interface AttemptRecord {
  count: number;
  lastAttemptAt: number;
}

// In-memory, keyed by the attempted email string itself (real or fake) —
// same anti-enumeration reasoning as the throttler it replaces: a real
// account and a probed fake email must be indistinguishable.
@Injectable()
export class LoginAttemptTracker {
  private readonly attempts = new Map<string, AttemptRecord>();

  requiresCaptcha(email: string): boolean {
    return this.getCount(email) >= CAPTCHA_REQUIRED_AFTER;
  }

  recordFailure(email: string): void {
    const key = this.normalize(email);
    this.attempts.set(key, {
      count: this.getCount(email) + 1,
      lastAttemptAt: Date.now(),
    });
  }

  reset(email: string): void {
    this.attempts.delete(this.normalize(email));
  }

  private getCount(email: string): number {
    const key = this.normalize(email);
    const record = this.attempts.get(key);

    if (!record) {
      return 0;
    }

    if (Date.now() - record.lastAttemptAt > ATTEMPT_WINDOW_MS) {
      this.attempts.delete(key);
      return 0;
    }

    return record.count;
  }

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }
}
