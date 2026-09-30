import * as argon2 from 'argon2';
import { In } from 'typeorm';
import dataSource from '../database/data-source';
import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { MembershipStatus } from '../database/entities/membership-status.enum';
import { Organisation } from '../database/entities/organisation.entity';
import { Project } from '../database/entities/project.entity';
import { TimeEntry } from '../database/entities/time-entry.entity';
import { ActivitySample } from '../database/entities/activity-sample.entity';
import { TimeEntrySource } from '../database/entities/time-entry-source.enum';
import { TimeEntryType } from '../database/entities/time-entry-type.enum';
import { Device } from '../database/entities/device.entity';
import { User } from '../database/entities/user.entity';

/**
 * Seeds one account per role, plus a fortnight of varied time entries, so the
 * timesheet's filters and permission gates have something real to bite on.
 *
 * Idempotent: accounts are keyed on email and their entries are replaced on
 * each run, so re-running refreshes the data rather than piling it up.
 *
 *   pnpm --filter backend seed:test-accounts
 *   pnpm --filter backend seed:test-accounts --clean   (removes them again)
 *
 * Refuses to touch a database that isn't on localhost — these are accounts
 * with a published password, and they have no business anywhere shared.
 */

const PASSWORD = 'TestPassw0rd!';
const EMAIL_DOMAIN = 'seed.test';

const ACCOUNTS: { name: string; role: MembershipRole }[] = [
  { name: 'Ada Admin', role: MembershipRole.ADMIN },
  { name: 'Mo Manager', role: MembershipRole.MANAGER },
  { name: 'Mia Member', role: MembershipRole.MEMBER },
  { name: 'Fin Finance', role: MembershipRole.FINANCE },
];

function emailFor(name: string): string {
  return `${name.split(' ')[0].toLowerCase()}@${EMAIL_DOMAIN}`;
}

/** Spread across sources and projects so every filter has both matches and
 * non-matches — a filter that can only ever return everything proves little. */
const SOURCES = [
  TimeEntrySource.AGENT,
  TimeEntrySource.WEB,
  TimeEntrySource.MANUAL,
];

/** Every kind, so the Time type filter has matches and non-matches alike. */
const TYPES = [
  TimeEntryType.NORMAL,
  TimeEntryType.IDLE,
  TimeEntryType.RESUMED,
  TimeEntryType.NORMAL,
];

/** Spread across the panel's thresholds so "> 80%" and "> 20%" return
 * genuinely different sets rather than everything or nothing. */
const ACTIVITY_LEVELS = [92, 15, 64, 78, 33, 97, 51];

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      'Refusing to seed: DATABASE_URL does not point at localhost. These accounts share one published password.',
    );
  }
}

/** Removes the seeded accounts and everything attributed to them. Ordered
 * innermost-first: the FKs are RESTRICT, so a membership can't go while its
 * entries or samples still point at it. */
async function clean(): Promise<void> {
  const seeded = await dataSource
    .getRepository(Membership)
    .createQueryBuilder('m')
    .innerJoin(User, 'u', 'u.id = m."userId"')
    .where('u.email LIKE :pattern', { pattern: `%@${EMAIL_DOMAIN}` })
    .getMany();

  if (seeded.length === 0) {
    console.log('Nothing seeded to remove.');
    return;
  }

  const membershipIds = seeded.map((membership) => membership.id);
  const userIds = seeded.map((membership) => membership.userId);

  await dataSource
    .getRepository(ActivitySample)
    .delete({ membershipId: In(membershipIds) });
  await dataSource
    .getRepository(TimeEntry)
    .delete({ membershipId: In(membershipIds) });
  await dataSource.getRepository(Membership).delete({ id: In(membershipIds) });
  await dataSource.getRepository(User).delete({ id: In(userIds) });

  console.log(`Removed ${seeded.length} seeded accounts and their data.`);
}

async function main(): Promise<void> {
  assertLocalDatabase();
  await dataSource.initialize();

  try {
    if (process.argv.includes('--clean')) {
      await clean();
      return;
    }

    const organisation = await dataSource.getRepository(Organisation).findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (!organisation) {
      throw new Error('No organisation to seed into — sign up first.');
    }

    const projects = await dataSource.getRepository(Project).find({
      where: { organisationId: organisation.id },
      order: { name: 'ASC' },
    });
    if (projects.length === 0) {
      throw new Error('No projects to log time against — create one first.');
    }

    const passwordHash = await argon2.hash(PASSWORD);
    const users = dataSource.getRepository(User);
    const activitySamples = dataSource.getRepository(ActivitySample);
    const device = await dataSource
      .getRepository(Device)
      .findOne({ where: { organisationId: organisation.id } });
    const memberships = dataSource.getRepository(Membership);
    const timeEntries = dataSource.getRepository(TimeEntry);

    for (const [accountIndex, account] of ACCOUNTS.entries()) {
      const email = emailFor(account.name);

      let user = await users.findOne({ where: { email } });
      user = await users.save({
        ...(user ?? {}),
        email,
        name: account.name,
        passwordHash,
        // Set, because a password is only ever set by following the emailed
        // link — which also proves the address. Skipping it here would leave
        // an account that cannot sign in.
        emailVerifiedAt: new Date(),
      } as User);

      let membership = await memberships.findOne({
        where: { userId: user.id, organisationId: organisation.id },
      });
      membership = await memberships.save({
        ...(membership ?? {}),
        userId: user.id,
        organisationId: organisation.id,
        role: account.role,
        status: MembershipStatus.ACTIVE,
      } as Membership);

      // Replace rather than add, so the shape stays predictable across runs.
      await timeEntries.delete({ membershipId: membership.id });
      await activitySamples.delete({ membershipId: membership.id });

      const entries: Partial<TimeEntry>[] = [];
      const samples: Partial<ActivitySample>[] = [];
      for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
        // Two entries a day, on different projects and sources, skipping
        // weekends so the calendar view looks like a real week.
        const day = new Date();
        day.setDate(day.getDate() - dayOffset);
        if (day.getDay() === 0 || day.getDay() === 6) continue;

        for (const slot of [0, 1]) {
          const startedAt = new Date(day);
          startedAt.setHours(9 + slot * 4, 0, 0, 0);
          const endedAt = new Date(startedAt);
          endedAt.setHours(startedAt.getHours() + 2 + slot);
          if (endedAt.getTime() > Date.now()) continue;

          const source = SOURCES[(dayOffset + slot) % SOURCES.length];
          entries.push({
            organisationId: organisation.id,
            membershipId: membership.id,
            projectId:
              projects[(dayOffset + slot + accountIndex) % projects.length].id,
            taskId: null,
            startedAt,
            endedAt,
            source,
            // Hand-entered time is manual by construction; the rest cycles
            // so every type is represented.
            type:
              source === TimeEntrySource.MANUAL
                ? TimeEntryType.MANUAL
                : TYPES[(dayOffset + slot + accountIndex) % TYPES.length],
            deviceId: null,
          });

          // One 10-minute sample per entry hour. A Device is required by the
          // FK, so activity is only seeded where the org has one paired.
          if (device) {
            for (
              let periodStart = new Date(startedAt);
              periodStart < endedAt;
              periodStart = new Date(periodStart.getTime() + 10 * 60_000)
            ) {
              const periodEnd = new Date(periodStart.getTime() + 10 * 60_000);
              if (periodEnd > endedAt) break;
              samples.push({
                organisationId: organisation.id,
                membershipId: membership.id,
                deviceId: device.id,
                activePercentage:
                  ACTIVITY_LEVELS[samples.length % ACTIVITY_LEVELS.length],
                periodStart,
                periodEnd,
              });
            }
          }
        }
      }
      await timeEntries.save(entries.map((entry) => timeEntries.create(entry)));
      await activitySamples.save(
        samples.map((sample) => activitySamples.create(sample)),
      );

      console.log(
        `${account.role.padEnd(8)} ${email.padEnd(24)} ${entries.length} entries, ${samples.length} activity samples`,
      );
    }

    console.log(`\nOrganisation: ${organisation.name}`);
    console.log(`Password for all of them: ${PASSWORD}`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
