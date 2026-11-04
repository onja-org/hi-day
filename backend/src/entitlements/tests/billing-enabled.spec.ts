import {
  BILLING_ENABLED_VAR,
  isBillingEnabled,
  parseBillingEnabled,
} from '../billing-enabled';

/** A wrong read either way is not symmetric: reading a bad value as "on"
 * shows a self-hoster a paywall they were promised they'd never see. */
describe('what counts as billing being on', () => {
  it('is on for "true", however it is cased or padded', () => {
    for (const value of ['true', 'TRUE', ' True ']) {
      expect(parseBillingEnabled(value)).toBe(true);
    }
  });

  it('is off for anything else at all', () => {
    for (const value of [
      undefined,
      '',
      'false',
      '1',
      'yes',
      'on',
      'enabled',
      'ture',
    ]) {
      expect(parseBillingEnabled(value)).toBe(false);
    }
  });
});

describe('reading it from the environment', () => {
  const ORIGINAL = process.env[BILLING_ENABLED_VAR];

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env[BILLING_ENABLED_VAR];
    else process.env[BILLING_ENABLED_VAR] = ORIGINAL;
  });

  it('prefers what is already in the environment over the .env file', () => {
    process.env[BILLING_ENABLED_VAR] = 'true';
    expect(isBillingEnabled()).toBe(true);

    process.env[BILLING_ENABLED_VAR] = 'false';
    expect(isBillingEnabled()).toBe(false);
  });

  // Keeps the cases above hermetic — an explicit env never reaches disk.
  it('never consults the file for an environment passed in', () => {
    expect(isBillingEnabled({})).toBe(false);
    expect(isBillingEnabled({ [BILLING_ENABLED_VAR]: 'true' })).toBe(true);
  });
});
