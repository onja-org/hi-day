/**
 * Turning a Stripe decline into a sentence somebody can act on. Free of Nest
 * and the Stripe SDK.
 */

/** The shape read off a PaymentIntent's `last_payment_error`. */
export interface DeclineError {
  message?: string;
  decline_code?: string;
  code?: string;
}

/**
 * For the rare decline that arrives without a message. Only the codes an
 * issuer returns for a routine seat charge; anything rarer falls through to
 * the generic line rather than being guessed at, since a wrong reason sends
 * somebody to their bank over a card that was fine.
 */
const DECLINE_MESSAGES: Record<string, string> = {
  insufficient_funds:
    'The card does not have enough funds to cover the charge.',
  card_declined: 'The card was declined.',
  expired_card: 'The card has expired.',
  incorrect_cvc: 'The card security code was incorrect.',
  processing_error: 'The card issuer could not process the charge.',
  lost_card: 'The card has been reported lost.',
  stolen_card: 'The card has been reported stolen.',
};

const GENERIC_REASON = 'The payment was declined by the card issuer.';

/**
 * Prefers Stripe's own `message`, which its docs say is safe to show
 * cardholders, then the `decline_code`, then a generic line.
 *
 * Never returns an empty string: this goes in an email whose whole purpose
 * is to say why, and "failed because" followed by nothing is worse than a
 * vague reason.
 */
export function declineReason(error: DeclineError | null | undefined): string {
  const message = error?.message?.trim();
  if (message) return message;

  const code = error?.decline_code?.trim() || error?.code?.trim();
  if (code && DECLINE_MESSAGES[code]) return DECLINE_MESSAGES[code];

  return GENERIC_REASON;
}
