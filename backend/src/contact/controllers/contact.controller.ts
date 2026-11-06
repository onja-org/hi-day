import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ContactMessageDto } from '../dto/contact-message.dto';
import { ContactService } from '../services/contact.service';

/** Five messages per ten minutes, per sender — see the module's tracker. */
export const CONTACT_THROTTLE_LIMIT = 5;
export const CONTACT_THROTTLE_TTL_MS = 10 * 60 * 1000;
/** Volume across every sender at once — all a per-IP key can mean here. */
export const GLOBAL_CONTACT_THROTTLE_LIMIT = 100;

/**
 * Deliberately outside every auth guard: somebody asking whether the product
 * fits their team does not have an account yet. The honeypot and the rate
 * limit are what stand in for a session.
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: GLOBAL_CONTACT_THROTTLE_LIMIT,
      ttl: CONTACT_THROTTLE_TTL_MS,
    },
    contact: { limit: CONTACT_THROTTLE_LIMIT, ttl: CONTACT_THROTTLE_TTL_MS },
  })
  async send(@Body() dto: ContactMessageDto): Promise<{ sent: true }> {
    const result = await this.contactService.send(dto);

    switch (result.kind) {
      // A caught bot is told exactly what a person is told. Anything else
      // teaches it which field to leave alone next time.
      case 'sent':
      case 'ignored':
        return { sent: true };
      case 'invalid':
        // Field errors under `errors`, so the form can put each message
        // under the input it belongs to rather than in one banner.
        throw new BadRequestException({
          message: 'Some details need fixing.',
          errors: result.errors,
        });
      case 'failed':
        throw new InternalServerErrorException(
          'Something went wrong. Please try again.',
        );
    }
  }
}
