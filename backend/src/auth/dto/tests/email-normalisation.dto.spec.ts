import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAccountDto } from '../create-account.dto';
import { ForgotPasswordDto } from '../forgot-password.dto';
import { LoginDto } from '../login.dto';
import { ResendVerificationDto } from '../resend-verification.dto';

describe('email normalisation in auth DTOs', () => {
  const cases: [
    string,
    new () => { email: string },
    Record<string, unknown>,
  ][] = [
    ['LoginDto', LoginDto, { password: 'secret' }],
    [
      'CreateAccountDto',
      CreateAccountDto,
      {
        firstName: 'Jane',
        lastName: 'Doe',
        companyName: 'Corp',
        address: '1 Main St',
      },
    ],
    ['ForgotPasswordDto', ForgotPasswordDto, {}],
    ['ResendVerificationDto', ResendVerificationDto, {}],
  ];

  it.each(cases)(
    '%s trims and lowercases the email, and it still validates',
    async (_name, Dto, rest) => {
      const dto = plainToInstance(Dto, {
        ...rest,
        email: '  Jane@Corp.COM ',
      });

      expect(dto.email).toBe('jane@corp.com');
      await expect(validate(dto)).resolves.toEqual([]);
    },
  );

  it('leaves a non-string email for the validator to reject', async () => {
    const dto = plainToInstance(LoginDto, { email: 42, password: 'secret' });

    expect(dto.email).toBe(42);
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toEqual(['email']);
  });
});
