import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AcceptInvitationDto } from '../../../members/dto/accept-invitation.dto';
import { ResetPasswordDto } from '../reset-password.dto';
import { SetPasswordDto } from '../set-password.dto';
import {
  COMMON_PASSWORD_MESSAGE,
  PASSWORD_TOO_SHORT_MESSAGE,
  isCommonPassword,
  passwordContainsEmail,
} from '../password-policy';

async function passwordErrors(
  dtoClass: typeof SetPasswordDto | typeof ResetPasswordDto,
  password: string,
): Promise<string[]> {
  const dto = plainToInstance(dtoClass, { token: 'the-token', password });
  const errors = await validate(dto);
  return errors
    .filter((error) => error.property === 'password')
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('password policy', () => {
  describe.each([
    ['SetPasswordDto', SetPasswordDto],
    ['ResetPasswordDto', ResetPasswordDto],
  ])('%s', (_name, dtoClass) => {
    it('accepts a 10-character password with no digit', async () => {
      expect(await passwordErrors(dtoClass, 'tangerines')).toEqual([]);
    });

    it('refuses a 9-character password', async () => {
      expect(await passwordErrors(dtoClass, 'abcdefgh1')).toContain(
        PASSWORD_TOO_SHORT_MESSAGE,
      );
    });

    it('refuses the old minimum, "abc123"', async () => {
      expect(await passwordErrors(dtoClass, 'abc123')).toContain(
        PASSWORD_TOO_SHORT_MESSAGE,
      );
    });

    it.each(['password123', 'qwertyuiop', 'QWERTYUIOP'])(
      'refuses the common password "%s"',
      async (password) => {
        expect(await passwordErrors(dtoClass, password)).toContain(
          COMMON_PASSWORD_MESSAGE,
        );
      },
    );
  });

  describe('AcceptInvitationDto', () => {
    it('refuses a short or common password when one is sent', async () => {
      for (const password of ['short1', 'password123']) {
        const dto = plainToInstance(AcceptInvitationDto, { password });
        const errors = await validate(dto);
        expect(errors.some((error) => error.property === 'password')).toBe(
          true,
        );
      }
    });

    it('still accepts no password, for an existing account', async () => {
      const dto = plainToInstance(AcceptInvitationDto, {});
      expect(await validate(dto)).toEqual([]);
    });
  });

  describe('isCommonPassword', () => {
    it('ignores case', () => {
      expect(isCommonPassword('PassWord123')).toBe(true);
    });

    it('lets an uncommon passphrase through', () => {
      expect(isCommonPassword('violet-kettle-harbour')).toBe(false);
    });
  });

  describe('passwordContainsEmail', () => {
    it('finds the email anywhere, ignoring case', () => {
      expect(
        passwordContainsEmail('my JANE@acme.test pw', 'jane@acme.test'),
      ).toBe(true);
    });

    it('allows a password that only shares part of the email', () => {
      expect(passwordContainsEmail('jane-likes-tea', 'jane@acme.test')).toBe(
        false,
      );
    });
  });
});
