import {
  generateRecoveryCode,
  normalizeRecoveryCode,
} from '../recovery-codes.util';

describe('recovery-codes.util', () => {
  it('generates two dash-separated groups of five unambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRecoveryCode()).toMatch(
        /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/,
      );
    }
  });

  it('generates different codes each time', () => {
    const codes = new Set(
      Array.from({ length: 100 }, () => generateRecoveryCode()),
    );
    expect(codes.size).toBe(100);
  });

  it('ignores case, spaces and dashes when normalising', () => {
    expect(normalizeRecoveryCode(' abcde fghjk ')).toBe('ABCDEFGHJK');
    expect(normalizeRecoveryCode('ABCDE-FGHJK')).toBe('ABCDEFGHJK');
  });
});
