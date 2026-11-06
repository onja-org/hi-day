import { isStripeMissing } from '../stripe-missing';

describe('isStripeMissing', () => {
  it("recognises Stripe's resource_missing", () => {
    expect(
      isStripeMissing(
        Object.assign(new Error('No such subscription'), {
          code: 'resource_missing',
        }),
      ),
    ).toBe(true);
  });

  // A network failure or a refusal must surface, not be read as "gone".
  it.each([
    ['another Stripe error', { code: 'card_declined' }],
    ['a network failure', new Error('ECONNRESET')],
    ['null', null],
    ['undefined', undefined],
  ])('does not mistake %s for a missing object', (_, error) => {
    expect(isStripeMissing(error)).toBe(false);
  });
});
