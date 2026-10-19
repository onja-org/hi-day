import {
  buildCsv,
  buildReportCsv,
  buildReportPdf,
  buildTablePdf,
  csvCell,
  formatDuration,
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

describe('shared file helpers', () => {
  it('formatDuration pads hours, minutes and seconds, and is empty for null', () => {
    expect(formatDuration(3725)).toBe('01:02:05');
    expect(formatDuration(null)).toBe('');
  });

  it('csvCell prefixes formula triggers and quotes commas and quotes', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell('plain')).toBe('plain');
  });

  it('buildCsv joins the header and rows with CRLF', () => {
    expect(buildCsv(['A', 'B'], [['1', '2,3']])).toBe('A,B\r\n1,"2,3"');
  });

  it('buildTablePdf returns a PDF', () => {
    const pdf = buildTablePdf('T', ['A'], [['1']], 7);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('report-file.util without projects', () => {
  it('leaves the project out of the header and every row', () => {
    const csv = buildReportCsv([entry()], 'UTC', false);

    expect(csv.split('\r\n')[0]).not.toContain('Project');
    expect(csv).not.toContain('Alpha');
  });

  it('keeps the project while projects are on', () => {
    expect(buildReportCsv([entry()], 'UTC').split('\r\n')[0]).toContain(
      'Project',
    );
  });
});
