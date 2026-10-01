import {
  buildReportCsv,
  buildReportPdf,
  reportRows,
  type ReportEntry,
} from './report-file.util';

function entry(overrides: Partial<ReportEntry> = {}): ReportEntry {
  return {
    startedAt: new Date('2026-09-28T09:00:00Z'),
    endedAt: new Date('2026-09-28T10:30:00Z'),
    projectName: 'Alpha',
    taskName: null,
    memberName: 'Ada',
    memberEmail: 'ada@example.com',
    durationSeconds: 5400,
    pausedSeconds: 120,
    source: 'web',
    ...overrides,
  };
}

describe('report-file.util', () => {
  it('formats a row on the organisation clock', () => {
    const [row] = reportRows([entry()], 'Africa/Nairobi');
    expect(row[0]).toBe('Mon, Sep 28, 2026');
    expect(row[4]).toBe('12:00 PM');
    expect(row[5]).toBe('1:30 PM');
    expect(row[6]).toBe('01:30:00');
    expect(row[7]).toBe('2');
    expect(row[9]).toBe('Africa/Nairobi');
  });

  it('falls back to the email, and marks a running entry', () => {
    const [row] = reportRows(
      [entry({ memberName: null, endedAt: null, durationSeconds: null })],
      'UTC',
    );
    expect(row[1]).toBe('ada@example.com');
    expect(row[5]).toBe('In progress');
    expect(row[6]).toBe('');
  });

  it('writes a header and one CSV line per entry', () => {
    const lines = buildReportCsv([entry(), entry()], 'UTC').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      'Date,Member,Project,Task,Start,End,Duration,Paused (min),Source,Time zone',
    );
  });

  it('quotes cells containing commas, quotes and new lines', () => {
    const csv = buildReportCsv([entry({ projectName: 'A, "B"\nC' })], 'UTC');
    expect(csv).toContain('"A, ""B""\nC"');
  });

  it('defuses cells a spreadsheet would run as a formula', () => {
    const csv = buildReportCsv(
      [entry({ projectName: '=HYPERLINK("x")', taskName: '@cmd' })],
      'UTC',
    );
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(",'@cmd,");
  });

  it('builds a real PDF', () => {
    const pdf = buildReportPdf('Weekly', [entry()], 'UTC');
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
