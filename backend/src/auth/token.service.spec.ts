import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  it('signs an access token carrying the user id as the subject', () => {
    const sign = jest.fn().mockReturnValue('signed.jwt.token');
    const jwtService = { sign } as unknown as JwtService;
    const service = new TokenService(jwtService);

    const token = service.signAccessToken('user-1');

    expect(sign).toHaveBeenCalledWith({ sub: 'user-1' });
    expect(token).toBe('signed.jwt.token');
  });

  it('generates unique, non-empty email verification tokens', () => {
    const service = new TokenService({} as JwtService);

    const first = service.generateEmailVerificationToken();
    const second = service.generateEmailVerificationToken();

    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThan(20);
  });
});
