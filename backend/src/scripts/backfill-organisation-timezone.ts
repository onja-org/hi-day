import type { EntityManager } from 'typeorm';
import dataSource from '../database/data-source';
import { isValidTimezone } from '../common/timezone.util';

/**
 * One-off: gives Organisations still on the default `UTC` the zone their
 * people are actually in. New ones are now founded in the zone the browser
 * reports; this is for those created before that.
 *
 *   pnpm --filter backend backfill:org-timezone
 *   pnpm --filter backend backfill:org-timezone --apply
 *   pnpm --filter backend backfill:org-timezone --org <publicId> --apply
 *
 * Reports and exits unless `--apply` is passed.
 *
 * **It cannot tell a deliberate UTC from an untouched default** — nothing
 * records that a setting was changed — so the dry run prints its evidence
 * per Organisation and `--org` applies them one at a time.
 *
 * Changing a zone moves which day past entries fall on, so reports either
 * side of a midnight shift. Take a backup.
 */

/** An Organisation still on the default, with what is known about where it is. */
export interface Candidate {
  id: string;
  publicId: number;
  name: string;
  currentTimezone: string | null;
  /** The founder's own reported zone, if a client ever reported one. */
  ownerTimezone: string | null;
  /** Distinct zones reported by active members, the owner included. */
  memberTimezones: string[];
}

export interface Proposal {
  zone: string;
  /** Why this zone, so the table says what it is relying on. */
  reason: 'owner' | 'members agree';
}

/**
 * The zone to move an Organisation to, or `null` to leave it alone. The
 * founder's own first; failing that the members', but only where every
 * member who reports one reports the same — a split team has no single
 * answer this is entitled to pick.
 */
export function proposeTimezone(candidate: Candidate): Proposal | null {
  const current = candidate.currentTimezone ?? 'UTC';

  const owner = candidate.ownerTimezone;
  if (owner && isValidTimezone(owner)) {
    return owner === current ? null : { zone: owner, reason: 'owner' };
  }

  const agreed = [...new Set(candidate.memberTimezones)].filter((zone) =>
    isValidTimezone(zone),
  );
  if (agreed.length !== 1) return null;
  return agreed[0] === current
    ? null
    : { zone: agreed[0], reason: 'members agree' };
}

/** Organisations whose zone is still the default nobody chose. */
export async function findCandidates(
  manager: EntityManager,
  publicId?: number,
): Promise<Candidate[]> {
  return await manager.query<Candidate[]>(
    `SELECT o."id",
            o."publicId",
            o."name",
            o."settings"->>'timezone'            AS "currentTimezone",
            owner."timezone"                      AS "ownerTimezone",
            COALESCE(
              ARRAY(
                SELECT DISTINCT u."timezone"
                  FROM "memberships" m
                  JOIN "users" u ON u."id" = m."userId"
                 WHERE m."organisationId" = o."id"
                   AND m."status" = 'active'
                   AND u."timezone" IS NOT NULL
              ),
              '{}'
            )                                     AS "memberTimezones"
       FROM "organisations" o
       LEFT JOIN "users" owner ON owner."id" = o."ownerUserId"
      WHERE COALESCE(o."settings"->>'timezone', 'UTC') = 'UTC'
        AND ($1::int IS NULL OR o."publicId" = $1::int)
      ORDER BY o."publicId"`,
    [publicId ?? null],
  );
}

/** Writes the zone, and a trace of it: nothing else records such a change. */
export async function applyTimezone(
  manager: EntityManager,
  candidate: Candidate,
  proposal: Proposal,
): Promise<void> {
  await manager.query(
    `UPDATE "organisations"
        SET "settings" = jsonb_set("settings", '{timezone}', to_jsonb($2::text))
      WHERE "id" = $1`,
    [candidate.id, proposal.zone],
  );
  await manager.query(
    `INSERT INTO "audit_logs" ("action", "organisationId", "actorUserId", "metadata")
     VALUES ($1, $2, NULL, $3)`,
    [
      'organisation.timezone_backfilled',
      candidate.id,
      JSON.stringify({
        from: candidate.currentTimezone ?? 'UTC',
        to: proposal.zone,
        basis: proposal.reason,
      }),
    ],
  );
}

function readOrgArg(): number | undefined {
  const index = process.argv.indexOf('--org');
  if (index === -1) return undefined;
  const publicId = Number(process.argv[index + 1]);
  if (!Number.isInteger(publicId)) {
    throw new Error('Pass the Organisation with --org <publicId>.');
  }
  return publicId;
}

function describe(candidate: Candidate, proposal: Proposal | null): string {
  const name = candidate.name.slice(0, 24).padEnd(24);
  const id = String(candidate.publicId).padStart(5);
  const owner = (candidate.ownerTimezone ?? '—').padEnd(21);
  const members = candidate.memberTimezones.length
    ? candidate.memberTimezones.join(', ')
    : '—';
  const verdict = proposal
    ? `-> ${proposal.zone} (${proposal.reason})`
    : '-> leave alone';
  return `${id}  ${name}  owner ${owner} members ${members}\n         ${verdict}`;
}

async function main(): Promise<void> {
  const publicId = readOrgArg();
  const apply = process.argv.includes('--apply');
  await dataSource.initialize();

  try {
    const candidates = await findCandidates(dataSource.manager, publicId);
    if (candidates.length === 0) {
      console.log('No Organisation is still on the default UTC.');
      return;
    }

    console.log(
      `${candidates.length} Organisation(s) still on UTC.\n` +
        'Nothing records whether that was chosen, so read each line before applying.\n',
    );

    const planned: { candidate: Candidate; proposal: Proposal }[] = [];
    for (const candidate of candidates) {
      const proposal = proposeTimezone(candidate);
      console.log(describe(candidate, proposal));
      if (proposal) planned.push({ candidate, proposal });
    }

    console.log(
      `\n${planned.length} would change, ` +
        `${candidates.length - planned.length} left alone ` +
        '(no zone reported, or members disagree — set those by hand in Settings).',
    );

    if (!apply) {
      console.log(
        '\nDry run — nothing changed. Back up the database, then re-run with --apply.',
      );
      return;
    }

    // One transaction: a half-applied run leaves no record of where it got to.
    await dataSource.transaction(async (manager) => {
      for (const { candidate, proposal } of planned) {
        await applyTimezone(manager, candidate, proposal);
      }
    });

    console.log(`\nDone. ${planned.length} Organisation(s) moved off UTC.`);
    console.log(
      'Days either side of a midnight now fall differently — expect reports to shift.',
    );
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
