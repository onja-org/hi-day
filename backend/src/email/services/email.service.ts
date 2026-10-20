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
   * Tells an organisation's owner their trial is nearly up. `daysLeft` is
   * already rounded the way the in-app banner rounds it, so the email and the
   * banner never disagree about how long is left; `1` is the final day.
   */
  async sendTrialReminderEmail(
    to: string,
    organisationName: string,
    daysLeft: number,
  ): Promise<void> {
    const pricingUrl = `${this.frontendUrl}/pricing`;
    const when = `ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: `Your ${APP_NAME} trial ${when}`,
      html: `<p>Your free trial of ${APP_NAME} for <strong>${escapeHtml(organisationName)}</strong> ${when}. Take a look at what Hi Day Cloud costs to keep your team tracking without interruption.</p>${this.button(pricingUrl, 'See pricing')}<p>Nothing is locked during the trial, and you have not been charged.</p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send trial reminder to ${to}: ${error.message}`,
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
