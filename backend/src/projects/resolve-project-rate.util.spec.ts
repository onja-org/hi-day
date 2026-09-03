import { resolveProjectRate } from './resolve-project-rate.util';

describe('resolveProjectRate', () => {
  it('returns the per-user override when the membership has a rate', () => {
    expect(resolveProjectRate({ rate: '50.00' }, { rate: '75.00' })).toBe(
      '75.00',
    );
  });

  it('falls back to the project rate when the membership has no override', () => {
    expect(resolveProjectRate({ rate: '50.00' }, { rate: null })).toBe('50.00');
  });

  it('falls back to the project rate when there is no membership record', () => {
    expect(resolveProjectRate({ rate: '50.00' }, null)).toBe('50.00');
  });

  it('returns null when neither the project nor the membership has a rate', () => {
    expect(resolveProjectRate({ rate: null }, { rate: null })).toBeNull();
    expect(resolveProjectRate({ rate: null }, null)).toBeNull();
  });
});
