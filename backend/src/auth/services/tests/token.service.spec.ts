import { TokenService } from '../token.service';

describe('TokenService', () => {
  it('generates unique, non-empty opaque tokens', () => {
    const service = new TokenService();

    const first = service.generateToken();
    const second = service.generateToken();

    expect(first).not.toEqual(second);
    expect(first.length).toBeGreaterThan(20);
  });
});
