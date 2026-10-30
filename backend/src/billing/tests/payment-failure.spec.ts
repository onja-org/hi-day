import { declineReason } from '../payment-failure';

describe('declineReason', () => {
  it("prefers Stripe's own message, which is written for cardholders", () => {
    expect(
      declineReason({
        message: 'Your card has insufficient funds.',
        decline_code: 'insufficient_funds',
      }),
    ).toBe('Your card has insufficient funds.');
  });

  it('falls back to the decline code when no message came with it', () => {
    expect(declineReason({ decline_code: 'insufficient_funds' })).toBe(
      'The card does not have enough funds to cover the charge.',
    );
  });

  it('reads the error code where there is no decline code', () => {
    expect(declineReason({ code: 'expired_card' })).toBe(
      'The card has expired.',
    );
  });

  it('stays generic for a code it does not recognise, rather than guessing', () => {
    expect(declineReason({ decline_code: 'something_new' })).toBe(
      'The payment was declined by the card issuer.',
    );
  });

  it.each([null, undefined, {}, { message: '   ' }])(
    'never returns nothing, given %p',
    (error) => {
      expect(declineReason(error).length).toBeGreaterThan(0);
    },
  );
});
