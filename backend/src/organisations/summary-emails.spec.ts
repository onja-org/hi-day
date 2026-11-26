import { resolveSummaryFrequency, summaryEmailEnabled } from './summary-emails';

describe('resolveSummaryFrequency', () => {
  it('defaults to weekly when nobody chose anything', () => {
    expect(resolveSummaryFrequency(undefined, null)).toBe('weekly');
  });

  it('uses the organisation default, then the member override', () => {
    expect(resolveSummaryFrequency('both', null)).toBe('both');
    expect(resolveSummaryFrequency('both', 'off')).toBe('off');
    expect(resolveSummaryFrequency('off', 'daily')).toBe('daily');
  });
});

describe('summaryEmailEnabled', () => {
  const base = { organisationDefault: undefined, membershipOverride: null };

  it('sends weekly but not daily out of the box', () => {
    expect(
      summaryEmailEnabled('personal-weekly', { ...base, optOuts: [] }),
    ).toBe(true);
    expect(
      summaryEmailEnabled('personal-daily', { ...base, optOuts: [] }),
    ).toBe(false);
  });

  it("lets a person's opt-out win over the admin's choice", () => {
    expect(
      summaryEmailEnabled('team-daily', {
        organisationDefault: 'both',
        membershipOverride: 'both',
        optOuts: ['team-daily'],
      }),
    ).toBe(false);
    expect(
      summaryEmailEnabled('team-weekly', {
        organisationDefault: 'both',
        membershipOverride: 'both',
        optOuts: ['team-daily'],
      }),
    ).toBe(true);
  });

  it('never sends what the admin turned off', () => {
    expect(
      summaryEmailEnabled('personal-weekly', {
        organisationDefault: 'both',
        membershipOverride: 'off',
        optOuts: [],
      }),
    ).toBe(false);
  });
});
