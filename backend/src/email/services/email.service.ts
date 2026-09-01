import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

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

  async sendSetPasswordEmail(to: string, token: string): Promise<void> {
    const setPasswordUrl = `${this.frontendUrl}/set-password?token=${encodeURIComponent(token)}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: 'Set your password',
      html: `<p>Confirm your email address and set your password to finish creating your account:</p><p><a href="${setPasswordUrl}">${setPasswordUrl}</a></p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send set-password email to ${to}: ${error.message}`,
      );
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: 'Reset your password',
      html: `<p>We received a request to reset your password. This link expires soon and can only be used once:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send password-reset email to ${to}: ${error.message}`,
      );
    }
  }

  async sendDuplicateRegistrationNotice(to: string): Promise<void> {
    const loginUrl = `${this.frontendUrl}/login`;

    const { error } = await this.resend.emails.send({
      from: this.emailSender,
      to,
      subject: 'Someone tried to register with your email',
      html: `<p>Someone just tried to create a new account using this email address, which is already registered. If this wasn't you, no action is needed. If it was, sign in to your existing account instead.</p><p><a href="${loginUrl}" style="display:inline-block;padding:10px 20px;background-color:#259cd9;color:#ffffff;text-decoration:none;border-radius:6px;">Sign in to your account</a></p>`,
    });

    if (error) {
      this.logger.error(
        `Failed to send duplicate-registration notice to ${to}: ${error.message}`,
      );
    }
  }
}
