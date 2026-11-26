import {
  buildPersonalSummaryEmail,
  buildTeamSummaryEmail,
  formatSummaryDelta,
  formatSummaryDuration,
  TEAM_ROW_LIMIT,
} from '../summary-email-content.util';
import type { MemberPeriodStats } from '../summary-stats.util';

const links = {
  unsubscribeUrl: 'https://app.test/unsubscribe?token=t',
  settingsUrl: 'https://app.test/account/edit',
};

const stats = (
  totalSeconds: number,
  extra: Partial<MemberPeriodStats> = {},
): MemberPeriodStats => ({
  totalSeconds,
  byDay: [{ dateKey: '2026-11-23', seconds: totalSeconds }],
  byProject: [],
  activityPercentage: null,
  ...extra,
});

const personal = (overrides = {}) =>
  buildPersonalSummaryEmail({
    period: 'daily',
    range: { fromKey: '2026-11-23', toKey: '2026-11-23' },
    organisationName: 'Acme',
    stats: stats(3600 * 7 + 300, {
      activityPercentage: 61,
      byProject: [{ projectId: 'p', name: 'Website', seconds: 3600 }],
    }),
    previousTotalSeconds: 3600 * 6,
    showProjects: true,
    showActivity: true,
    manualEditCount: 0,
    timesheetUrl: 'https://app.test/organisations/100001/time_entries',
    links,
    ...overrides,
  });

describe('formatting', () => {
  it('formats durations and deltas', () => {
    expect(formatSummaryDuration(0)).toBe('0m');
    expect(formatSummaryDuration(45 * 60)).toBe('45m');
    expect(formatSummaryDuration(7 * 3600 + 5 * 60)).toBe('7h 05m');
    expect(formatSummaryDelta(30)).toBe('no change');
    expect(formatSummaryDelta(-25 * 60)).toBe('−25m');
    expect(formatSummaryDelta(3600 + 600)).toBe('+1h 10m');
  });
});

describe('buildPersonalSummaryEmail', () => {
  it('names the organisation and the total in the subject', () => {
    expect(personal().subject).toBe(
      'Your day at Acme: 7h 05m tracked (Mon, Nov 23, 2026)',
    );
  });

  it('shows activity and projects only when allowed', () => {
    expect(personal().html).toContain('61%');
    expect(personal().html).toContain('Website');
    const hidden = personal({ showActivity: false, showProjects: false }).html;
    expect(hidden).not.toContain('61%');
    expect(hidden).not.toContain('Website');
  });

  it('carries both footer links', () => {
    const { html } = personal();
    expect(html).toContain(links.unsubscribeUrl);
    expect(html).toContain(links.settingsUrl);
  });

  it('escapes the organisation name', () => {
    expect(personal({ organisationName: '<b>Acme</b>' }).html).toContain(
      '&lt;b&gt;Acme&lt;/b&gt;',
    );
  });
});

describe('buildTeamSummaryEmail', () => {
  const build = (
    members: Parameters<typeof buildTeamSummaryEmail>[0]['members'],
  ) =>
    buildTeamSummaryEmail({
      period: 'weekly',
      range: { fromKey: '2026-11-16', toKey: '2026-11-22' },
      organisationName: 'Acme',
      members,
      dashboardUrl: 'https://app.test/dashboard/100001/all',
      reportUrl: 'https://app.test/organisations/100001/reports/daily-totals',
      links,
    });

  it('highlights people with no time and lists the rest', () => {
    const { html, subject } = build([
      {
        name: 'Ana',
        stats: stats(3600),
        previousTotalSeconds: 0,
        manualEditCount: 2,
      },
      {
        name: '<script>Bo</script>',
        stats: stats(0),
        previousTotalSeconds: 60,
        manualEditCount: 0,
      },
    ]);
    expect(subject).toContain('1 with no time');
    expect(html).toContain('No time tracked (1)');
    expect(html).toContain('&lt;script&gt;Bo&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Manual time changes');
  });

  it('caps a long team and points to the report', () => {
    const members = Array.from({ length: TEAM_ROW_LIMIT + 3 }, (_, i) => ({
      name: `Person ${String(i).padStart(2, '0')}`,
      stats: stats(3600 + i),
      previousTotalSeconds: 0,
      manualEditCount: 0,
    }));
    expect(build(members).html).toContain('and 3 more');
  });
});
