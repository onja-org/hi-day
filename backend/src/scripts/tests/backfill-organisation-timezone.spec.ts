import type { EntityManager } from 'typeorm';
import {
  applyTimezone,
  proposeTimezone,
  type Candidate,
} from '../backfill-organisation-timezone';

describe('backfill-organisation-timezone', () => {
  function candidate(overrides: Partial<Candidate> = {}): Candidate {
    return {
      id: 'org-1',
      publicId: 7,
      name: 'Acme Inc',
      currentTimezone: 'UTC',
      ownerTimezone: null,
      memberTimezones: [],
      ...overrides,
    };
  }

  describe('proposeTimezone', () => {
    it('takes the founder’s own zone', () => {
      expect(
        proposeTimezone(candidate({ ownerTimezone: 'Indian/Antananarivo' })),
      ).toEqual({ zone: 'Indian/Antananarivo', reason: 'owner' });
    });

    it('falls back to the members when they all report the same', () => {
      expect(
        proposeTimezone(
          candidate({
            memberTimezones: ['Africa/Nairobi', 'Africa/Nairobi'],
          }),
        ),
      ).toEqual({ zone: 'Africa/Nairobi', reason: 'members agree' });
    });

    /** A split team has no single answer this script is entitled to pick. */
    it('leaves a team spread across zones alone', () => {
      expect(
        proposeTimezone(
          candidate({
            memberTimezones: ['Africa/Nairobi', 'Europe/Berlin'],
          }),
        ),
      ).toBeNull();
    });

    it('leaves one alone when nobody has reported a zone', () => {
      expect(proposeTimezone(candidate())).toBeNull();
    });

    /** Moving one to where it already is is noise. */
    it('leaves one alone when the reported zone is the one it already has', () => {
      expect(proposeTimezone(candidate({ ownerTimezone: 'UTC' }))).toBeNull();
    });

    it('ignores a stored zone this runtime does not recognise', () => {
      expect(
        proposeTimezone(
          candidate({
            ownerTimezone: 'Mars/Olympus',
            memberTimezones: ['Mars/Olympus'],
          }),
        ),
      ).toBeNull();
    });

    /** The owner is one person and the founder; the members are a vote. */
    it('prefers the founder over members who agree on something else', () => {
      expect(
        proposeTimezone(
          candidate({
            ownerTimezone: 'Indian/Antananarivo',
            memberTimezones: ['Europe/Berlin'],
          }),
        ),
      ).toEqual({ zone: 'Indian/Antananarivo', reason: 'owner' });
    });
  });

  describe('applyTimezone', () => {
    it('writes the zone and a trace of it, scoped to the one organisation', async () => {
      const query = jest.fn().mockResolvedValue([]);
      const manager = { query } as unknown as EntityManager;

      await applyTimezone(manager, candidate(), {
        zone: 'Indian/Antananarivo',
        reason: 'owner',
      });

      const [update, audit] = query.mock.calls as [string, unknown[]][];
      expect(update[0]).toContain('UPDATE "organisations"');
      expect(update[1]).toEqual(['org-1', 'Indian/Antananarivo']);
      // The only trace such a change has: `updateProfile` logs nothing.
      expect(audit[0]).toContain('INSERT INTO "audit_logs"');
      expect(audit[1][0]).toBe('organisation.timezone_backfilled');
      expect(audit[1][1]).toBe('org-1');
      expect(JSON.parse(audit[1][2] as string)).toEqual({
        from: 'UTC',
        to: 'Indian/Antananarivo',
        basis: 'owner',
      });
    });
  });
});
