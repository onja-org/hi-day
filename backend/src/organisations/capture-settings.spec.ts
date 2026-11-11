import {
  DEFAULT_MEMBERS_CAN_VIEW_OWN_ACTIVITY,
  resolveCanViewOwnActivity,
} from './capture-settings';

describe('resolveCanViewOwnActivity', () => {
  it("lets a member's own override win over the organisation default", () => {
    expect(resolveCanViewOwnActivity(true, false)).toBe(false);
    expect(resolveCanViewOwnActivity(false, true)).toBe(true);
  });

  it('keeps a `false` override — it is a decision, not a missing value', () => {
    // `??` is load-bearing: `||` would throw the override away and report
    // the member as visible.
    expect(resolveCanViewOwnActivity(undefined, false)).toBe(false);
  });

  it('falls back to the organisation default when the member inherits', () => {
    expect(resolveCanViewOwnActivity(false, null)).toBe(false);
    expect(resolveCanViewOwnActivity(true, null)).toBe(true);
  });

  it('falls back to the built-in default when neither is set', () => {
    expect(resolveCanViewOwnActivity(undefined, null)).toBe(
      DEFAULT_MEMBERS_CAN_VIEW_OWN_ACTIVITY,
    );
  });

  it('treats an undefined override the same as an inheriting one', () => {
    expect(resolveCanViewOwnActivity(false, undefined)).toBe(false);
  });
});
