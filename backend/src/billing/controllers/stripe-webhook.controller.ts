import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookService } from '../services/stripe-webhook.service';

/**
 * Stripe's callback. Deliberately outside every guard — Stripe has no
 * session and no organisation in its URL — and authenticated instead by the
 * signature over the raw body, which `main.ts` keeps unparsed for this path.
 */
@Controller('billing/webhook')
export class StripeWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: Request,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    const event = this.webhooks.verify(request.body as Buffer, signature);
    // Throws `UnplacedStripeEvent` (503) for an event it could not act on,
    // which is what asks Stripe to send it again — a thrown HttpException
    // sets the status itself, so the 200 below applies only to success.
    // Answering 200 regardless used to mean a dropped event was dropped for
    // good, leaving a paying customer on a trial with nothing to fix it.
    await this.webhooks.handle(event);
    // 200 for an event we ignore on purpose: anything else makes Stripe
    // retry something that will never succeed.
    return { received: true };
  }
}
