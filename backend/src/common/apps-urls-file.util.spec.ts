import { buildAppsUrlsTable } from './apps-urls-file.util';

const items = [
  {
    dateKey: '2026-10-05',
    projectName: 'Alpha',
    memberName: 'Ada',
    label: 'Code',
    seconds: 3000,
  },
  {
    dateKey: '2026-10-05',
    projectName: 'Alpha',
    memberName: 'Ada',
    label: 'Code',
    seconds: 600,
  },
  {
    dateKey: '2026-10-05',
    projectName: 'Alpha',
    memberName: 'Ada',
    label: 'example.com',
    seconds: 1200,
  },
  {
    dateKey: '2026-10-06',
    projectName: 'Beta',
    memberName: 'Ben',
    label: 'Code',
    seconds: 3600,
  },
];

describe('buildAppsUrlsTable', () => {
  it('leads with the grouping column and sums matching rows', () => {
    const table = buildAppsUrlsTable(items, 'day');
    expect(table.header).toEqual([
      'Date',
      'Project / Work order',
      'Member',
      'App or site',
      'Time spent (hrs)',
      'Percent used',
    ]);
    expect(table.body).toHaveLength(3);
    expect(table.body[0].slice(1)).toEqual([
      'Alpha',
      'Ada',
      'Code',
      '01:00:00',
      '75%',
    ]);
    expect(table.body[1].slice(3)).toEqual(['example.com', '00:20:00', '25%']);
  });

  it('groups by project, putting that column first', () => {
    const table = buildAppsUrlsTable(items, 'project');
    expect(table.header[0]).toBe('Project / Work order');
    expect(table.body.map((row) => row[0])).toEqual(['Alpha', 'Alpha', 'Beta']);
    expect(table.body[2][5]).toBe('100%');
  });

  it('returns no rows for no items', () => {
    expect(buildAppsUrlsTable([], 'member').body).toEqual([]);
  });
});

describe('buildAppsUrlsTable without projects', () => {
  it('drops the project column, and the "No project" it would have held', () => {
    const table = buildAppsUrlsTable(
      items.map((item) => ({ ...item, projectName: 'No project' })),
      'day',
      false,
    );

    expect(table.header).toEqual([
      'Date',
      'Member',
      'App or site',
      'Time spent (hrs)',
      'Percent used',
    ]);
    expect(table.body.flat()).not.toContain('No project');
  });

  it('groups by day when a saved report still asks for project', () => {
    const table = buildAppsUrlsTable(items, 'project', false);

    expect(table.header[0]).toBe('Date');
  });

  it('leaves the table alone while projects are on', () => {
    expect(buildAppsUrlsTable(items, 'project').header[0]).toBe(
      'Project / Work order',
    );
  });
});
