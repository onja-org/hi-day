import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { BillingPeriod } from '../pricing';
import {
  MAX_PURCHASABLE_SEATS,
  MIN_PURCHASABLE_SEATS,
  parseSeatCount,
} from '../seats';
import type { SubscriptionIntent } from '../services/checkout.service';
import { CheckoutService } from '../services/checkout.service';
import type { BilledSeats } from '../services/billed-seats.service';
import { BilledSeatsService } from '../services/billed-seats.service';
import type { TrialStatus } from '../services/trial.service';
import { SubscriptionReconcilerService } from '../services/subscription-reconciler.service';
import type {
  InvoiceSummary,
  PaidSubscriptionDetails,
  SeatChangePreview,
} from '../services/subscription.service';
import { SubscriptionService } from '../services/subscription.service';
import { TrialService } from '../services/trial.service';

/**
 * Admin-only at the API, not merely hidden in the UI, so the rule holds for
 * every future client too.
 */
@Controller('organisations/:id/billing')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN)
export class BillingController {
  constructor(
    private readonly trialService: TrialService,
    private readonly billedSeatsService: BilledSeatsService,
    private readonly checkoutService: CheckoutService,
    private readonly reconciler: SubscriptionReconcilerService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Where to send the admin to pay. Returns a URL rather than redirecting,
   * so the browser leaves the app deliberately rather than being bounced
   * mid-request.
   */
  /**
   * The in-app payment modal's counterpart: a subscription waiting on a card,
   * and the secret Elements confirms it against. Admin-only like the rest of
   * Billing, so a manager or member cannot start a charge.
   */
  @Post('payment-intent')
  async createPaymentIntent(
    @Req() request: AuthenticatedRequest,
    @Body('period') period: BillingPeriod,
    /** What the modal showed. Checked against the server's own count. */
    @Body('seats') seats?: unknown,
  ): Promise<SubscriptionIntent> {
    return this.checkoutService.createSubscriptionIntent(
      request.organisationId!,
      period,
      typeof seats === 'number' ? seats : undefined,
    );
  }

  @Post('checkout')
  async startCheckout(
    @Req() request: AuthenticatedRequest,
    @Body('period') period: BillingPeriod,
  ): Promise<{ url: string }> {
    return {
      url: await this.checkoutService.createSessionUrl(
        request.organisationId!,
        period,
      ),
    };
  }

  /**
   * `trial: null` for an Organisation created before trials existed — a
   * normal state, not a failure, so it answers 200 rather than a 404 the UI
   * would have to render as an error.
   *
   * `isFree` is read from configuration and wins over any trial: an
   * Organisation that never pays has nothing counting down, whatever its
   * subscription row says.
   */
  /** Who the Organisation pays for, and how many — the same query for both. */
  /**
   * How many seats the admin has bought. Not a cap — see `billedSeatCount`
   * — so this changes what the next invoice covers, never who may join.
   */
  @Put('seats')
  async setSeats(
    @Req() request: AuthenticatedRequest,
    @Body('seats') seats: unknown,
  ): Promise<BilledSeats> {
    const parsed = parseSeatCount(seats);
    if (parsed === null) {
      throw new BadRequestException(
        `Seats must be a whole number between ${MIN_PURCHASABLE_SEATS} and ${MAX_PURCHASABLE_SEATS}.`,
      );
    }
    return this.billedSeatsService.setPurchasedSeats(
      request.organisationId!,
      parsed,
    );
  }

  /**
   * The paid subscription, read live from Stripe. Null for a trial, which
   * is the Billing page's signal to show the trial card instead.
   */
  @Get('subscription')
  getSubscription(
    @Req() request: AuthenticatedRequest,
  ): Promise<PaidSubscriptionDetails | null> {
    return this.subscriptionService.detailsFor(request.organisationId!);
  }

  /** What a seat change would cost, from Stripe's own invoice preview. */
  @Post('seats/preview')
  async previewSeats(
    @Req() request: AuthenticatedRequest,
    @Body('seats') seats: unknown,
  ): Promise<SeatChangePreview> {
    const parsed = parseSeatCount(seats);
    if (parsed === null) {
      throw new BadRequestException(
        `Seats must be a whole number between ${MIN_PURCHASABLE_SEATS} and ${MAX_PURCHASABLE_SEATS}.`,
      );
    }
    return this.subscriptionService.previewSeatChange(
      request.organisationId!,
      parsed,
    );
  }

  /** Everything Stripe has billed for, newest first. */
  @Get('invoices')
  getInvoices(@Req() request: AuthenticatedRequest): Promise<InvoiceSummary[]> {
    return this.subscriptionService.invoicesFor(request.organisationId!);
  }

  /**
   * A one-time link into Stripe's Customer Portal, where the card, the
   * billing email and the invoice history are managed. Hosted rather than
   * rebuilt here — see `SubscriptionService.portalUrl`.
   */
  @Post('portal')
  async openPortal(
    @Req() request: AuthenticatedRequest,
    @Body('returnUrl') returnUrl: unknown,
  ): Promise<{ url: string }> {
    if (typeof returnUrl !== 'string' || !returnUrl.startsWith('http')) {
      throw new BadRequestException('A return URL is required.');
    }
    return {
      url: await this.subscriptionService.portalUrl(
        request.organisationId!,
        returnUrl,
      ),
    };
  }

  @Get('seats')
  getSeats(@Req() request: AuthenticatedRequest): Promise<BilledSeats> {
    return this.billedSeatsService.forOrganisation(request.organisationId!);
  }

  @Get('trial')
  async getTrial(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ trial: TrialStatus | null; isFree: boolean }> {
    // Asked before answering, because this is the page somebody opens when
    // the answer looks wrong. It repairs an Organisation that paid while we
    // were not listening and is otherwise a no-op — see the reconciler for
    // why that is cheap.
    await this.reconciler.reconcile(request.organisationId!);

    return {
      trial: await this.trialService.findStatus(request.organisationId!),
      isFree: this.trialService.isFree(Number(request.params.id)),
    };
  }
}
