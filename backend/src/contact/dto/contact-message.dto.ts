import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MESSAGE_MAX_LENGTH } from '../contact-message';

/**
 * Only the shape, not the rules.
 *
 * The rules live in `contact-message.ts`, which the browser runs the same
 * copy of — putting them in decorators here would be a second set that
 * drifts. What this does is stop anything enormous reaching the validator at
 * all: a megabyte of text in `message` is not a validation question.
 */
export class ContactMessageDto {
  @IsString()
  @MaxLength(320)
  email: string;

  @IsString()
  @MaxLength(2048)
  website: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @IsString()
  // Generous against the real limit so an over-long message is reported as
  // "keep it under 2000" rather than rejected with no field error at all.
  @MaxLength(MESSAGE_MAX_LENGTH * 4)
  message: string;

  /** The honeypot. Never shown, so anything here is a bot. */
  @IsOptional()
  @IsString()
  @MaxLength(256)
  company?: string;
}
