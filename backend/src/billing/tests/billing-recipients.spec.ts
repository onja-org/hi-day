import { billingRecipients, invoiceRecipient } from '../billing-recipients';

describe('billingRecipients', () => {
  it('is the owner alone until somebody sets a billing address', () => {
    expect(billingRecipients(null, 'owner@acme.test')).toEqual([
      'owner@acme.test',
    ]);
  });

  // Never the billing address alone: it is unverified, and a typo must not
  // be able to swallow the warning that access is ending.
  it('keeps the owner when a billing address is set', () => {
    expect(billingRecipients('ap@acme.test', 'owner@acme.test')).toEqual([
      'owner@acme.test',
      'ap@acme.test',
    ]);
  });

  it('sends once when they are the same mailbox', () => {
    expect(billingRecipients('Owner@Acme.test', 'owner@acme.test')).toEqual([
      'owner@acme.test',
    ]);
  });

  it('falls back to the billing address where the owner is gone', () => {
    expect(billingRecipients('ap@acme.test', null)).toEqual(['ap@acme.test']);
  });

  it('has nobody to tell when neither exists', () => {
    expect(billingRecipients(null, null)).toEqual([]);
    expect(billingRecipients('  ', '')).toEqual([]);
  });
});

describe('invoiceRecipient', () => {
  // One address, unlike a warning: a duplicate receipt in two inboxes is how
  // a bill gets paid twice.
  it('is the billing address when one is set', () => {
    expect(invoiceRecipient('ap@acme.test', 'owner@acme.test')).toBe(
      'ap@acme.test',
    );
  });

  it('falls back to the owner when none is set', () => {
    expect(invoiceRecipient(null, 'owner@acme.test')).toBe('owner@acme.test');
    expect(invoiceRecipient('   ', 'owner@acme.test')).toBe('owner@acme.test');
  });

  it('has nobody to send to when neither exists', () => {
    expect(invoiceRecipient(null, null)).toBeNull();
    expect(invoiceRecipient('', '')).toBeNull();
  });
});
