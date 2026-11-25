import { ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { COMMON_PASSWORDS } from './common-passwords';

/**
 * Length is what makes a password hard to guess, so it is the one rule a
 * new password has to meet: no "a letter and a number", which only pushed
 * people to "abc123". Applies only when a password is set (signup, invite
 * acceptance, reset). Login never checks it, so a password chosen under
 * the old rule keeps working.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_TOO_SHORT_MESSAGE = `Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
export const COMMON_PASSWORD_MESSAGE =
  'That password is too common and easy to guess. Choose a different one.';
export const PASSWORD_CONTAINS_EMAIL_MESSAGE =
  "Your password can't contain your email address.";

const commonPasswords = new Set(COMMON_PASSWORDS);

export function isCommonPassword(password: string): boolean {
  return commonPasswords.has(password.toLowerCase());
}

/**
 * The email isn't in a set-password request, only on the account the
 * token leads to, so the service checks this rather than the DTO.
 */
export function passwordContainsEmail(
  password: string,
  email: string,
): boolean {
  if (!email) return false;
  return password.toLowerCase().includes(email.toLowerCase());
}

@ValidatorConstraint({ name: 'isNotCommonPassword' })
export class IsNotCommonPassword implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && !isCommonPassword(value);
  }

  defaultMessage(): string {
    return COMMON_PASSWORD_MESSAGE;
  }
}
