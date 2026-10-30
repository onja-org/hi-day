import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const APP_NAME = 'Hi Day';
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ReportEmail {
  to: string[];
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
  organisationName: string;
  attachment: { filename: string; content: Buffer };
}

const BUTTON_STYLE =
  'display:inline-block;padding:10px 20px;background-color:#259cd9;color:#ffffff;text-decoration:none;border-radius:6px;';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly emailSender: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
    this.emailSender = this.configService.getOrThrow<string>('EMAIL_SENDER');
    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
  }

  private button(url: string, label: string): string {
    return `<p><a href="${url}" style="${BUTTON_STYLE}">${label}</a></p>`;
  }

  async sendSetPasswordEmail(
    to: string,
    token: string,
    organisationName: string,
  ): Promise<void> {
    const setPasswordUrl = `${this.frontendUrl}/set-password?token=${encodeURIComponent(token)}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Set your password for ${organisationName}`,
      html: `<p>Welcome to <strong>${organisationName}</strong> on ${APP_NAME}. Confirm your email address and set your password to finish creating your account:</p><p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send set-password email to ${to}: ${error.message}`,
      );
    }
  }

  async sendPasswordResetEmail(
    to: string,
    token: string,
    organisationName: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Reset your ${APP_NAME} password`,
      html: `<p>We received a request to reset the password for your <strong>${organisationName}</strong> account on ${APP_NAME}. This link expires soon and can only be used once:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send password-reset email to ${to}: ${error.message}`,
      );
    }
  }

  async sendInvitationEmail(
    to: string,
    token: string,
    organisationName: string,
  ): Promise<void> {
    const acceptUrl = `${this.frontendUrl}/accept-invitation?token=${encodeURIComponent(token)}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Join ${organisationName} on ${APP_NAME}`,
      html: `<p>You've been invited to join <strong>${organisationName}</strong> on ${APP_NAME}. This link expires soon and can only be used once:</p>${this.button(acceptUrl, `Join ${organisationName}`)}`,
    });

    if (error) {
      this.logger.error(
        `Failed to send invitation email to ${to}: ${error.message}`,
      );
    }
  }

  async sendDuplicateRegistrationNotice(
    to: string,
    organisationName: string,
  ): Promise<void> {
    const loginUrl = `${this.frontendUrl}/login`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: 'Someone tried to register with your email',
      html: `<p>Someone just tried to create a new account on ${APP_NAME} using this email address, which is already registered to <strong>${organisationName}</strong>. If this wasn't you, no action is needed. If it was, sign in to your existing account instead.</p>${this.button(loginUrl, 'Sign in to your account')}`,
    });

    if (error) {
      this.logger.error(
        `Failed to send duplicate-registration notice to ${to}: ${error.message}`,
      );
    }
  }

  async sendOrganisationDeletionConfirmationEmail(
    to: string,
    token: string,
    organisationPublicId: number,
    organisationName: string,
    when: string,
  ): Promise<void> {
    const confirmUrl = `${this.frontendUrl}/organisations/${organisationPublicId}/settings?confirmDeletion=${encodeURIComponent(token)}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Confirm deletion of ${organisationName}`,
      html: `<p>You asked to delete <strong>${organisationName}</strong> on ${APP_NAME} (${when}). Nothing happens until you confirm. This link expires soon and can only be used once.</p>${this.button(confirmUrl, 'Confirm deletion')}<p>If you didn't request this, ignore this email and consider changing your password.</p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send deletion confirmation to ${to}: ${error.message}`,
      );
    }
  }

  async sendOrganisationDeletionNotice(
    to: string,
    organisationName: string,
    details: string,
  ): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `${organisationName}: account deletion`,
      html: `<p>${details}</p><p>Organisation: <strong>${organisationName}</strong></p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send deletion notice to ${to}: ${error.message}`,
      );
    }
  }

  /**
   * Tells an organisation's owner their trial is nearly up, or has just run
   * out. `daysLeft` is rounded the way the in-app banner rounds it, so the
   * two never disagree: `1` is the final day, `0` means it has ended.
   */
  /**
   * The receipt for a payment Stripe has taken — the first one and every
   * renewal after it.
   *
   * Links Stripe's own hosted invoice rather than attaching a PDF: the
   * hosted page always reflects the invoice as it stands (a later refund or
   * credit note shows there), where an attachment is a snapshot that starts
   * disagreeing with the account the moment anything changes.
   */
  async sendInvoiceEmail(
    to: string,
    organisationName: string,
    amount: string,
    invoiceUrl: string | null,
    /** Stripe's own invoice number, where it has finalised one. */
    reference: string | null,
  ): Promise<void> {
    const name = escapeHtml(organisationName);
    const line = reference ? ` (invoice ${escapeHtml(reference)})` : '';

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Your ${APP_NAME} receipt — ${amount}`,
      html: `<p>Thanks — we've received <strong>${escapeHtml(amount)}</strong> for <strong>${name}</strong>${line}.</p>${
        invoiceUrl
          ? this.button(invoiceUrl, 'View or download invoice')
          : '<p>Your invoice will be available in Settings → Billing.</p>'
      }<p>This is a receipt for your records. Nothing further is needed.</p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send invoice email to ${to}: ${error.message}`,
      );
    }
  }

  /**
   * A message from the public contact form, to whoever
   * `CONTACT_RECIPIENT_EMAIL` names.
   *
   * Every value is escaped before it reaches the HTML. All of it is typed by
   * a stranger with no account, so a message containing
   * `<img src=x onerror=…>` must arrive as that text and not as markup in
   * the inbox of whoever reads these.
   *
   * `replyTo` is the sender's address, which is the whole point: replying
   * goes to them rather than to the mailbox this arrived in. It is
   * deliberately *not* the `from` — sending as an address we do not own is
   * what fails SPF and lands the lot in spam.
   */
  async sendContactMessage(
    to: string,
    message: {
      email: string;
      website: string;
      phone: string | null;
      message: string;
      sentAt: Date;
    },
  ): Promise<void> {
    const email = escapeHtml(message.email);
    const website = escapeHtml(message.website);

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      replyTo: message.email,
      subject: `New contact message from ${message.email}`,
      html: [
        `<p><strong>From:</strong> ${email}</p>`,
        `<p><strong>Website:</strong> <a href="${website}">${website}</a></p>`,
        `<p><strong>Phone:</strong> ${message.phone ? escapeHtml(message.phone) : 'Not provided'}</p>`,
        `<p><strong>Sent:</strong> ${escapeHtml(message.sentAt.toISOString())}</p>`,
        '<hr />',
        // Newlines become breaks after escaping, never before: escaping
        // afterwards would turn the <br> back into text.
        `<p>${escapeHtml(message.message).replace(/\r?\n/g, '<br />')}</p>`,
      ].join(''),
    });

    if (error) {
      // Thrown, not swallowed: the form promises the person it was sent, and
      // the controller answers 500 so they can try again rather than being
      // told it worked.
      throw new Error(`Resend refused the contact message: ${error.message}`);
    }
  }

  async sendTrialReminderEmail(
    /** The owner, plus the billing address when one is set — see
     * `billingRecipients`. Resend takes an array for several. */
    to: string | string[],
    organisationName: string,
    daysLeft: number,
    accessEndsOn: string,
  ): Promise<void> {
    const pricingUrl = `${this.frontendUrl}/pricing`;
    const name = escapeHtml(organisationName);

    // `0` is the trial having actually run out, which is a different message
    // from a warning: it names the date access stops rather than asking them
    // to look at prices at their leisure.
    const ended = daysLeft === 0;
    const subject = ended
      ? `Your ${APP_NAME} trial has ended`
      : `Your ${APP_NAME} trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
    const body = ended
      ? `<p>The free trial of ${APP_NAME} for <strong>${name}</strong> has ended. Your team can carry on working until <strong>${escapeHtml(accessEndsOn)}</strong>; after that, tracking stops until a payment method is added.</p>`
      : `<p>Your free trial of ${APP_NAME} for <strong>${name}</strong> ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Take a look at what Hi Day Cloud costs to keep your team tracking without interruption.</p>`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject,
      html: `${body}${this.button(pricingUrl, 'See pricing')}<p>You have not been charged.</p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send trial reminder to ${Array.isArray(to) ? to.join(', ') : to}: ${error.message}`,
      );
    }
  }

  /**
   * Tells whoever pays the bill that a seat charge was declined.
   *
   * Sent to the owner *and* the billing address (`billingRecipients`),
   * unlike a receipt. The seats are already in use by people who joined,
   * so this is the message that must not be swallowed by a typo in an
   * unverified billing address.
   *
   * The reason comes from Stripe and is written for cardholders, but it is
   * escaped anyway: it reaches us over the network and nothing downstream
   * of here would catch markup in it.
   */
  async sendSeatChargeFailedEmail(
    to: string | string[],
    organisationName: string,
    amount: string,
    reason: string,
    /** Stripe's hosted invoice page, where the card can be retried. */
    invoiceUrl: string | null,
  ): Promise<void> {
    const name = escapeHtml(organisationName);
    const billingUrl = `${this.frontendUrl}/settings/billing`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Action needed: a ${APP_NAME} seat payment failed`,
      html:
        `<p>We could not take <strong>${escapeHtml(amount)}</strong> for the new seats added to <strong>${name}</strong>.</p>` +
        `<p><strong>Reason given:</strong> ${escapeHtml(reason)}</p>` +
        `<p>The people who joined are working normally and nothing has been removed. The charge will be retried automatically, so the usual fix is to make sure the card on file can cover it — or replace it.</p>` +
        this.button(
          invoiceUrl ?? billingUrl,
          invoiceUrl ? 'Pay or retry this invoice' : 'Update payment details',
        ),
    });

    if (error) {
      this.logger.error(
        `Failed to send seat charge failure to ${Array.isArray(to) ? to.join(', ') : to}: ${error.message}`,
      );
    }
  }

  /**
   * Emails a report file on behalf of a member. Unlike the account emails
   * above, the caller is waiting on this one, so it reports whether it went
   * out instead of swallowing the failure. The sender's own text is escaped
   * — it's user input — and replies go to the sender, not the no-reply
   * address.
   */
  async sendReportEmail(report: ReportEmail): Promise<boolean> {
    const message = report.message.trim()
      ? `<p style="white-space:pre-wrap">${escapeHtml(report.message.trim())}</p>`
      : '';

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to: report.to,
      replyTo: report.senderEmail,
      subject: report.subject,
      html: `${message}<p>${escapeHtml(report.senderName)} sent you a report from <strong>${escapeHtml(report.organisationName)}</strong> on ${APP_NAME}. It is attached to this email.</p>`,
      attachments: [
        {
          filename: report.attachment.filename,
          content: report.attachment.content,
        },
      ],
    });

    if (error) {
      this.logger.error(`Failed to send report email: ${error.message}`);
      return false;
    }
    return true;
  }
}
