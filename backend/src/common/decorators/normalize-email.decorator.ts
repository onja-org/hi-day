import { Transform } from 'class-transformer';
import { normalizeEmail } from '../email.util';

/**
 * Trims and lowercases an email field before validation, so services only
 * ever see the canonical form (see `normalizeEmail`). Non-strings pass
 * through untouched for the validators to reject.
 */
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  );
}
