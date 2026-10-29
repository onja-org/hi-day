import { BadRequestException } from '@nestjs/common';
import { CheckoutService } from '../checkout.service';

/**
 * The seat counter saves debounced, so an admin can raise it and press Add
 * payment before the save lands. Charging the old figure against a modal
 * showing the new one is the outcome worth failing a request over.
 */
function serviceFor(authoritativeSeats: number) {
  const service = new CheckoutService(
    { findOne: jest.fn().mockResolvedValue(null) } as never,
    {
      findOne: jest.fn().mockResolvedValue({ id: 'org-1', publicId: 100001 }),
    } as never,
    {
      isConfigured: true,
      isFree: () => false,
      priceIdFor: () => 'price_1',
      stripe: {},
    } as never,
    {
      forOrganisation: jest
        .fn()
        .mockResolvedValue({ count: authoritativeSeats }),
    } as never,
    { getOrThrow: () => 'https://app.example.com' } as never,
  );
  return service;
}

describe('the seat count the modal displayed', () => {
  it('refuses to charge when it no longer matches the server', async () => {
    const service = serviceFor(6);

    await expect(
      service.createSubscriptionIntent('org-1', 'annual', 8),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('names the real figure so the modal can show the right total', async () => {
    const service = serviceFor(6);

    await expect(
      service.createSubscriptionIntent('org-1', 'annual', 8),
    ).rejects.toThrow(/changed to 6/);
  });

  // No expectation sent — the trial banner, which has no counter — so the
  // server's own count stands unchallenged.
  it('charges its own count when the caller states no expectation', async () => {
    const service = serviceFor(6);

    // Gets past the check and fails later, at Stripe, which is not mocked.
    await expect(
      service.createSubscriptionIntent('org-1', 'annual'),
    ).rejects.not.toBeInstanceOf(BadRequestException);
  });
});
