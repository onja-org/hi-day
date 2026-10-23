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
    await this.webhooks.handle(event);
    // 200 even for an event we ignore: anything else makes Stripe retry it
    // for days.
    return { received: true };
  }
}
