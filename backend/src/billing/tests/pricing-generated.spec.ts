import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BILLING_PERIODS,
  CLOUD_BILLING_NOTE,
  monthlyPriceLabel,
  TRIAL_DAYS,
  TRIAL_PROMISE,
} from '../pricing';

/**
 * The frontend's copy of the advertised prices is generated from the
 * constants above and committed, so the public pricing page keeps rendering
 * with no backend call. That only works if drift fails the build: without
 * this, changing a price here would leave the marketing page advertising the
 * old one until somebody noticed.
 *
 * Run `pnpm gen:pricing` to fix a failure here.
 */
const generated = readFileSync(
  join(__dirname, '../../../../frontend/src/lib/pricing.generated.ts'),
  'utf-8',
);

describe('frontend pricing.generated.ts', () => {
  it('advertises the price each period actually charges', () => {
    for (const period of BILLING_PERIODS) {
      expect(generated).toContain(`${period}: "${monthlyPriceLabel(period)}"`);
    }
  });

  it('carries the same billing notes', () => {
    for (const period of BILLING_PERIODS) {
      expect(generated).toContain(`${period}: "${CLOUD_BILLING_NOTE[period]}"`);
    }
  });

  it('offers exactly the periods the backend does', () => {
    expect(generated).toContain(
      `BILLING_PERIODS: BillingPeriod[] = [${BILLING_PERIODS.map((p) => `"${p}"`).join(', ')}]`,
    );
  });

  it('agrees on the trial length and what it promises', () => {
    expect(generated).toContain(`TRIAL_DAYS = ${TRIAL_DAYS};`);
    expect(generated).toContain(
      `TRIAL_PROMISE = ${JSON.stringify(TRIAL_PROMISE)}`,
    );
  });
});
