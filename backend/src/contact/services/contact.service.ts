import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/services/email.service';
import {
  looksAutomated,
  normaliseWebsite,
  validateContactMessage,
  type ContactFieldErrors,
  type ContactMessageInput,
} from '../contact-message';

export type ContactResult =
  | { kind: 'sent' }
  /** Accepted and dropped: a bot must not learn it was caught. */
  | { kind: 'ignored' }
  | { kind: 'invalid'; errors: ContactFieldErrors }
  | { kind: 'failed' };

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly recipient: string | undefined;

  constructor(
    configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    // Read once, and never thrown over: a missing address must not take the
    // whole app down at boot for a form most installs never use. It is
    // logged loudly here and refused loudly per request.
    this.recipient = configService.get<string>('CONTACT_RECIPIENT_EMAIL');
    if (!this.recipient) {
      this.logger.error(
        'CONTACT_RECIPIENT_EMAIL is not set. The contact form will accept nothing until it is.',
      );
    }
  }

  async send(input: ContactMessageInput): Promise<ContactResult> {
    // Checked before anything else, and answered as success. A bot told
    // "invalid" learns which field is the trap and fills it correctly next
    // time; one told "sent" has no reason to come back.
    if (looksAutomated(input)) {
      this.logger.warn('Contact form honeypot filled; message dropped.');
      return { kind: 'ignored' };
    }

    // The same rules the browser ran, run again. The browser's copy is a
    // courtesy; this one is the gate.
    const errors = validateContactMessage(input);
    if (Object.keys(errors).length > 0) {
      return { kind: 'invalid', errors };
    }

    if (!this.recipient) {
      this.logger.error(
        'Contact message received but CONTACT_RECIPIENT_EMAIL is not set; nothing was sent.',
      );
      return { kind: 'failed' };
    }

    try {
      await this.emailService.sendContactMessage(this.recipient, {
        email: input.email.trim(),
        website: normaliseWebsite(input.website),
        phone: input.phone?.trim() || null,
        message: input.message.trim(),
        sentAt: new Date(),
      });
      return { kind: 'sent' };
    } catch (error) {
      this.logger.error(`Could not send contact message: ${String(error)}`);
      return { kind: 'failed' };
    }
  }
}
