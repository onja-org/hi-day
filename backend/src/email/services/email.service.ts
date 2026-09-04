import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const APP_NAME = 'Workforce Monitoring';
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
}
