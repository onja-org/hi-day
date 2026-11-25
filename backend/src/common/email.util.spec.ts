import { emailColumnTransformer, normalizeEmail } from './email.util';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Jane@Corp.COM \n')).toBe('jane@corp.com');
  });

  it('leaves an already-canonical address alone', () => {
    expect(normalizeEmail('jane@corp.com')).toBe('jane@corp.com');
  });
});

describe('emailColumnTransformer', () => {
  it('normalises strings on the way into the database', () => {
    expect(emailColumnTransformer.to('Jane@Corp.com')).toBe('jane@corp.com');
  });

  it('passes non-strings (e.g. find operators, null) through untouched', () => {
    const operator = { _type: 'in' };
    expect(emailColumnTransformer.to(operator)).toBe(operator);
    expect(emailColumnTransformer.to(null)).toBeNull();
  });

  it('returns stored values as-is', () => {
    expect(emailColumnTransformer.from('jane@corp.com')).toBe('jane@corp.com');
  });
});
