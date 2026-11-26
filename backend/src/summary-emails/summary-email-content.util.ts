import { escapeHtml } from '../common/escape-html.util';
import { emailButton } from '../email/services/email.service';
import type { SummaryPeriod } from '../organisations/summary-emails';
import type { DayRange } from './summary-period.util';
import type {
  MemberPeriodStats,
  SummaryProjectTime,
} from './summary-stats.util';

/** Past this, a team summary lists the rest as "and N more" and points to
 * the report — a long table is unreadable on a phone. */
export const TEAM_ROW_LIMIT = 25;
const TOP_PROJECTS = 5;

export interface SummaryEmailContent {
  subject: string;
  html: string;
}

export interface SummaryFooterLinks {
  /** Turns off exactly this email, without signing in. */
  unsubscribeUrl: string;
  /** Where the person manages all of their summary emails. */
  settingsUrl: string;
}

export interface PersonalSummaryInput {
  period: SummaryPeriod;
  range: DayRange;
  organisationName: string;
  stats: MemberPeriodStats;
  previousTotalSeconds: number;
  /** Off for someone who doesn't track against Projects. */
  showProjects: boolean;
  /** Off for someone not allowed to see their own activity in the app. */
  showActivity: boolean;
  manualEditCount: number;
  timesheetUrl: string;
  links: SummaryFooterLinks;
}

export interface TeamSummaryMember {
  name: string;
  stats: MemberPeriodStats;
  previousTotalSeconds: number;
  manualEditCount: number;
}

export interface TeamSummaryInput {
  period: SummaryPeriod;
  range: DayRange;
  organisationName: string;
  members: TeamSummaryMember[];
  dashboardUrl: string;
  reportUrl: string;
  links: SummaryFooterLinks;
}

/** "7h 05m", "45m", "0m". */
export function formatSummaryDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h ${String(rest).padStart(2, '0')}m`;
}

/** "+1h 10m", "−25m", "no change". */
export function formatSummaryDelta(seconds: number): string {
  if (Math.abs(seconds) < 60) return 'no change';
  return `${seconds > 0 ? '+' : '−'}${formatSummaryDuration(Math.abs(seconds))}`;
}

function formatDay(dateKey: string, withYear = false): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "Tue, Nov 25" or "Mon, Nov 17 – Sun, Nov 23, 2026". */
export function describeRange(range: DayRange): string {
  return range.fromKey === range.toKey
    ? formatDay(range.fromKey, true)
    : `${formatDay(range.fromKey)} – ${formatDay(range.toKey, true)}`;
}

const previousLabel = (period: SummaryPeriod): string =>
  period === 'daily' ? 'the day before' : 'the week before';

const CELL = 'padding:6px 12px 6px 0;border-bottom:1px solid #e5e5e5;';
const HEAD = `${CELL}text-align:left;font-weight:600;color:#4a4852;`;

function table(header: string[], rows: string[][]): string {
  const head = header
    .map((cell) => `<th style="${HEAD}">${cell}</th>`)
    .join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td style="${CELL}">${cell}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function headline(label: string, value: string, note: string): string {
  return `<p style="margin:16px 0 4px;color:#4a4852;font-size:13px;">${label}</p><p style="margin:0;font-size:28px;font-weight:700;color:#121117;">${value}</p><p style="margin:4px 0 16px;color:#4a4852;font-size:13px;">${note}</p>`;
}

function heading(text: string): string {
  return `<h3 style="margin:24px 0 8px;font-size:15px;color:#121117;">${text}</h3>`;
}

function projectRows(projects: SummaryProjectTime[]): string[][] {
  return projects.map((project) => [
    escapeHtml(project.name),
    formatSummaryDuration(project.seconds),
  ]);
}

function wrap(body: string, links: SummaryFooterLinks, why: string): string {
  return `<div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#121117;line-height:1.5;">${body}<p style="margin-top:32px;font-size:12px;color:#4a4852;">${why} <a href="${links.unsubscribeUrl}">Turn off this email</a> · <a href="${links.settingsUrl}">Manage summary emails</a></p></div>`;
}

export function buildPersonalSummaryEmail(
  input: PersonalSummaryInput,
): SummaryEmailContent {
  const { stats, period } = input;
  const organisation = escapeHtml(input.organisationName);
  const when = describeRange(input.range);
  const title = period === 'daily' ? 'Your day' : 'Your week';

  const parts: string[] = [
    `<h2 style="margin:0 0 4px;font-size:20px;">${title} at ${organisation}</h2><p style="margin:0;color:#4a4852;">${when}</p>`,
    headline(
      'Time tracked',
      formatSummaryDuration(stats.totalSeconds),
      `${formatSummaryDelta(stats.totalSeconds - input.previousTotalSeconds)} compared with ${previousLabel(period)}`,
    ),
  ];

  if (input.showActivity && stats.activityPercentage !== null) {
    parts.push(
      `<p style="margin:0 0 8px;">Average activity: <strong>${stats.activityPercentage}%</strong></p>`,
    );
  }

  if (period === 'weekly') {
    parts.push(
      heading('By day'),
      table(
        ['Day', 'Time'],
        stats.byDay.map((day) => [
          formatDay(day.dateKey),
          day.seconds > 0 ? formatSummaryDuration(day.seconds) : '–',
        ]),
      ),
    );
  }

  if (
    input.showProjects &&
    stats.byProject.some((project) => project.projectId !== null)
  ) {
    parts.push(
      heading('By project'),
      table(['Project', 'Time'], projectRows(stats.byProject)),
    );
  }

  if (input.manualEditCount > 0) {
    parts.push(
      `<p style="margin:16px 0 0;">${input.manualEditCount} manual time ${input.manualEditCount === 1 ? 'change was' : 'changes were'} made to your time in this period.</p>`,
    );
  }

  parts.push(
    `<p style="margin:16px 0 0;">Something missing or wrong? It's easiest to fix now.</p>`,
    emailButton(input.timesheetUrl, 'Open your timesheet'),
  );

  return {
    subject: `${title} at ${input.organisationName}: ${formatSummaryDuration(stats.totalSeconds)} tracked (${when})`,
    html: wrap(
      parts.join(''),
      input.links,
      `You get this ${period} summary as a member of ${organisation}.`,
    ),
  };
}

function withMore(
  rows: string[][],
  total: number,
  columns: number,
): string[][] {
  if (total <= rows.length) return rows;
  const more = `<em>and ${total - rows.length} more — see the full report</em>`;
  return [...rows, [more, ...Array<string>(columns - 1).fill('')]];
}

export function buildTeamSummaryEmail(
  input: TeamSummaryInput,
): SummaryEmailContent {
  const { period, members } = input;
  const organisation = escapeHtml(input.organisationName);
  const when = describeRange(input.range);
  const total = members.reduce((sum, m) => sum + m.stats.totalSeconds, 0);
  const previous = members.reduce((sum, m) => sum + m.previousTotalSeconds, 0);

  const tracked = members
    .filter((member) => member.stats.totalSeconds > 0)
    .sort(
      (a, b) =>
        b.stats.totalSeconds - a.stats.totalSeconds ||
        a.name.localeCompare(b.name),
    );
  const idle = members
    .filter((member) => member.stats.totalSeconds === 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const edited = members
    .filter((member) => member.manualEditCount > 0)
    .sort(
      (a, b) =>
        b.manualEditCount - a.manualEditCount || a.name.localeCompare(b.name),
    );

  const parts: string[] = [
    `<h2 style="margin:0 0 4px;font-size:20px;">Your team's ${period === 'daily' ? 'day' : 'week'} at ${organisation}</h2><p style="margin:0;color:#4a4852;">${when} · ${members.length} ${members.length === 1 ? 'person' : 'people'}</p>`,
    headline(
      'Team time tracked',
      formatSummaryDuration(total),
      `${formatSummaryDelta(total - previous)} compared with ${previousLabel(period)}`,
    ),
  ];

  if (idle.length > 0) {
    const names = idle.slice(0, TEAM_ROW_LIMIT).map((m) => escapeHtml(m.name));
    const more =
      idle.length > names.length
        ? ` and ${idle.length - names.length} more`
        : '';
    parts.push(
      `<div style="margin:16px 0;padding:12px 16px;background:#fff0c4;border-radius:6px;"><strong>No time tracked (${idle.length}):</strong> ${names.join(', ')}${more}</div>`,
    );
  }

  if (tracked.length > 0) {
    parts.push(
      heading('Time by person'),
      table(
        ['Person', 'Time', 'Change', 'Activity'],
        withMore(
          tracked
            .slice(0, TEAM_ROW_LIMIT)
            .map((member) => [
              escapeHtml(member.name),
              formatSummaryDuration(member.stats.totalSeconds),
              formatSummaryDelta(
                member.stats.totalSeconds - member.previousTotalSeconds,
              ),
              member.stats.activityPercentage === null
                ? '–'
                : `${member.stats.activityPercentage}%`,
            ]),
          tracked.length,
          4,
        ),
      ),
    );
  }

  const projectTotals = new Map<string, SummaryProjectTime>();
  for (const member of members) {
    for (const project of member.stats.byProject) {
      if (project.projectId === null) continue;
      const sum = projectTotals.get(project.projectId) ?? {
        ...project,
        seconds: 0,
      };
      sum.seconds += project.seconds;
      projectTotals.set(project.projectId, sum);
    }
  }
  if (projectTotals.size > 0) {
    parts.push(
      heading('Top projects'),
      table(
        ['Project', 'Time'],
        projectRows(
          [...projectTotals.values()]
            .sort(
              (a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name),
            )
            .slice(0, TOP_PROJECTS),
        ),
      ),
    );
  }

  if (edited.length > 0) {
    parts.push(
      heading('Manual time changes'),
      table(
        ['Person', 'Changes'],
        withMore(
          edited
            .slice(0, TEAM_ROW_LIMIT)
            .map((member) => [
              escapeHtml(member.name),
              String(member.manualEditCount),
            ]),
          edited.length,
          2,
        ),
      ),
    );
  }

  parts.push(
    emailButton(input.dashboardUrl, 'Open the team dashboard'),
    `<p style="margin:0;"><a href="${input.reportUrl}">See the full report</a></p>`,
  );

  return {
    subject: `Team ${period === 'daily' ? 'day' : 'week'} at ${input.organisationName}: ${formatSummaryDuration(total)} tracked${idle.length > 0 ? `, ${idle.length} with no time` : ''} (${when})`,
    html: wrap(
      parts.join(''),
      input.links,
      `You get this ${period} team summary as an admin or manager at ${organisation}.`,
    ),
  };
}
