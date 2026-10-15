import type { EntityManager } from 'typeorm';
import { removeProjects } from '../remove-organisation-projects';

describe('removeProjects', () => {
  function run() {
    const query = jest.fn().mockResolvedValue([]);
    const manager = { query } as unknown as EntityManager;
    return { query, manager, done: removeProjects(manager, 'org-1') };
  }

  async function statements(): Promise<string[]> {
    const { query, done } = run();
    await done;
    return query.mock.calls.map(([sql]: [string]) => sql.replace(/\s+/g, ' '));
  }

  it('scopes every statement to the one organisation', async () => {
    const { query, done } = run();
    await done;

    for (const [, params] of query.mock.calls as [string, unknown[]][]) {
      expect(params).toEqual(['org-1']);
    }
  });

  it('detaches entries before the projects and tasks they point at are deleted', async () => {
    const sql = await statements();
    const at = (fragment: string): number =>
      sql.findIndex((statement) => statement.includes(fragment));

    expect(at('UPDATE "time_entries"')).toBeGreaterThanOrEqual(0);
    expect(at('UPDATE "time_entries"')).toBeLessThan(at('DELETE FROM "tasks"'));
    expect(at('DELETE FROM "tasks"')).toBeLessThan(
      at('DELETE FROM "projects"'),
    );
    expect(at('DELETE FROM "project_memberships"')).toBeLessThan(
      at('DELETE FROM "projects"'),
    );
  });

  it('never deletes time entries', async () => {
    const sql = await statements();

    expect(sql.some((s) => s.includes('DELETE FROM "time_entries"'))).toBe(
      false,
    );
  });

  it('records that projects are off as the last step', async () => {
    const sql = await statements();

    expect(sql[sql.length - 1]).toContain('projectsEnabled');
    expect(sql[sql.length - 1]).toContain("'false'");
  });
});
