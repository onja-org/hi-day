import { ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import { isValidTimezone } from '../../common/timezone.util';

@ValidatorConstraint({ name: 'isIanaTimezone' })
export class IsIanaTimezone implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidTimezone(value);
  }

  defaultMessage(): string {
    return 'timezone must be an IANA zone such as Africa/Nairobi.';
  }
}
