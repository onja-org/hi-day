import {
  BILLING_ENABLED_VAR,
  isBillingEnabled,
  parseBillingEnabled,
} from '../billing-enabled';

/**
 * The two mistakes are not symmetric, which is the whole reason this is
 * stricter than the usual truthy-string parse. Off costs a Cloud deploy a
 * restart. On shows a self-hoster a paywall for a product we told them was
 * free forever — on an install with nothing to flag it as wrong.
 */
describe('what counts as billing being on', () => {
  it('is on for exactly "true"', () => {
    expect(parseBillingEnabled('true')).toBe(true);
  });

  it('tolerates the casing and padding a hand-edited .env picks up', () => {
    expect(parseBillingEnabled('TRUE')).toBe(true);
    expect(parseBillingEnabled(' True ')).toBe(true);
  });

  // The default, and the one that matters most: a fresh self-hosted install
  // has no .env entry at all and must still be free.
  it('is off when nobody set it', () => {
    expect(parseBillingEnabled(undefined)).toBe(false);
    expect(parseBillingEnabled('')).toBe(false);
  });

  it('is off for everything that merely looks affirmative', () => {
    for (const value of ['1', 'yes', 'on', 'y', 'enabled', 'TRUEE', 'ture']) {
      expect(parseBillingEnabled(value)).toBe(false);
    }
  });

  it('is off for an explicit false', () => {
    expect(parseBillingEnabled('false')).toBe(false);
  });
});

describe('reading it from the environment', () => {
  it('reads the documented variable name', () => {
    expect(isBillingEnabled({ [BILLING_ENABLED_VAR]: 'true' })).toBe(true);
    expect(isBillingEnabled({ [BILLING_ENABLED_VAR]: 'false' })).toBe(false);
  });

  it('is off for an environment that says nothing about billing', () => {
    expect(isBillingEnabled({})).toBe(false);
  });
});

/**
 * Registering the billing controllers happens while `app.module.ts` is still
 * being imported — before `ConfigModule.forRoot()` has loaded `.env`. Reading
 * `process.env` alone therefore missed a flag that lived only in the file,
 * which started Stripe and then 404'd every billing route: the backend
 * thought billing was on and the router never knew.
 */
describe('reading a flag that lives in the .env file', () => {
  const ORIGINAL = process.env[BILLING_ENABLED_VAR];

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env[BILLING_ENABLED_VAR];
    } else {
      process.env[BILLING_ENABLED_VAR] = ORIGINAL;
    }
  });

  // The precedence that keeps Docker and CI in charge: a variable already in
  // the environment is never overwritten by the file.
  it('prefers what is already in the environment', () => {
    process.env[BILLING_ENABLED_VAR] = 'false';
    expect(isBillingEnabled()).toBe(false);

    process.env[BILLING_ENABLED_VAR] = 'true';
    expect(isBillingEnabled()).toBe(true);
  });

  // An explicit environment is taken at its word and never reaches the disk,
  // which is what keeps the cases above hermetic.
  it('never consults the file for an environment passed in', () => {
    expect(isBillingEnabled({})).toBe(false);
    expect(isBillingEnabled({ [BILLING_ENABLED_VAR]: 'true' })).toBe(true);
  });
});
