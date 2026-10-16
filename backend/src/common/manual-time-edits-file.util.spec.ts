import {
  buildManualTimeEditsCsv,
  buildManualTimeEditsTable,
} from './manual-time-edits-file.util';

const edit = {
  action: 'delete' as const,
  memberName: null,
  memberEmail: 'ana@example.com',
  projectName: 'Website',
  taskName: null,
  startedAt: '2026-10-05T08:00:00.000Z',
  endedAt: '2026-10-05T09:30:00.000Z',
  changeSeconds: -5400,
  reason: 'Logged twice',
  changedByName: 'Admin',
  changedAt: '2026-10-05T10:00:00.000Z',
};

describe('buildManualTimeEditsTable', () => {
  it('labels the action, signs the change and falls back to dashes', () => {
    const [row] = buildManualTimeEditsTable([edit], 'UTC').body;

    expect(row[0]).toBe('ana@example.com');
    expect(row[2]).toBe('-');
    expect(row[3]).toBe('Delete');
    expect(row[5]).toBe('-01:30:00');
    expect(row[6]).toBe('Logged twice');
  });

  it('reads the timespan in the given zone', () => {
    const [row] = buildManualTimeEditsTable(
      [{ ...edit, startedAt: '2026-10-05T23:30:00.000Z', endedAt: null }],
      'Africa/Nairobi',
    ).body;

    expect(row[4]).toContain('Oct 6');
    expect(row[4]).toContain('In progress');
  });

  it('writes a header and a line per edit as CSV', () => {
    const csv = buildManualTimeEditsCsv(
      buildManualTimeEditsTable([edit], 'UTC'),
    );

    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv.startsWith('Member,')).toBe(true);
  });
});

describe('buildManualTimeEditsTable without projects', () => {
  it('drops the project column and its cell together', () => {
    const table = buildManualTimeEditsTable([edit], 'UTC', false);

    expect(table.header).not.toContain('Project / Work order');
    expect(table.body[0]).toHaveLength(table.header.length);
    expect(table.body[0]).not.toContain('Website');
  });
});
