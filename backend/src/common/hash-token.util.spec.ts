import { hashToken } from './hash-token.util';

describe('hashToken', () => {
  it('deterministically hashes the same token to the same value', () => {
    expect(hashToken('a-token')).toBe(hashToken('a-token'));
  });

  it('hashes different tokens to different values', () => {
    expect(hashToken('a-token')).not.toBe(hashToken('another-token'));
  });

  it('never returns the plaintext token', () => {
    expect(hashToken('a-token')).not.toBe('a-token');
  });
});
