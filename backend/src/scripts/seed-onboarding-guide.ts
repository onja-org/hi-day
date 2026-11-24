import * as argon2 from 'argon2';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EntityManager, In, QueryRunner } from 'typeorm';
import dataSource from '../database/data-source';
import { Membership } from '../database/entities/membership.entity';
import { MembershipRole } from '../database/entities/membership-role.enum';
import { MembershipStatus } from '../database/entities/membership-status.enum';
import { Organisation } from '../database/entities/organisation.entity';
import { OrganisationRegion } from '../database/entities/organisation-region.enum';
import { Project } from '../database/entities/project.entity';
import { ProjectColour } from '../database/entities/project-colour.enum';
import { ProjectMembership } from '../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../database/entities/project-membership-role.enum';
import { ProjectTeam } from '../database/entities/project-team.entity';
import { Subscription } from '../database/entities/subscription.entity';
import { SubscriptionStatus } from '../database/entities/subscription-status.enum';
import { Task } from '../database/entities/task.entity';
import { TaskStage } from '../database/entities/task-stage.enum';
import { Team } from '../database/entities/team.entity';
import { TeamMembership } from '../database/entities/team-membership.entity';
import { TimesheetReason } from '../database/entities/timesheet-reason.entity';
import { User } from '../database/entities/user.entity';
import { WorkClassification } from '../database/entities/work-classification.entity';
import { generateSlug } from '../organisations/slug.util';
import {
  HistorySeed,
  SeedContext,
  seedHistory,
} from './onboarding-guide/history';

/**
 * Builds the example company for the "Getting Started" guide screenshots
 * from `onboarding-guide/seed.json`, so the screenshots can be retaken with
 * the same story whenever the UI changes. The prompts that produced the seed
 * are in `onboarding-guide/PROMPTS.md`.
 *
 *   pnpm --filter backend seed:onboarding-guide           (creates it)
 *   pnpm --filter backend seed:onboarding-guide --clean   (removes it again)
 *
 * `--clean` removes every organisation any seed person belongs to, with all
 * its data, then the seed people themselves.
 *
 * Part 1 (this file): organisation, people, teams, projects, tasks,
 * settings and work time labels. Part 2 (`onboarding-guide/history.ts`):
 * about two months of work history.
 *
 * Excluded from the production build (see tsconfig.build.json) and refuses
 * to run against production or a non-local database: every seed person
 * shares one password written in this file.
 */

const PASSWORD = 'HiDArt2026!';
const SEED_PATH = join(__dirname, 'onboarding-guide', 'seed.json');

type SeedPerson = {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  orgRole: 'admin' | 'manager' | 'member';
};

type SeedTask = {
  name: string;
  assignee: string;
  stage: 'To do' | 'In progress' | 'Done';
  estimateHours: number;
};

type SeedProject = {
  name: string;
  description: string;
  colour: string;
  teams: string[];
  members: { person: string; role: 'Manager' | 'Member' | 'Viewer' }[];
  tasks: SeedTask[];
};

type Seed = HistorySeed & {
  organisation: {
    name: string;
    address: string;
    website: string;
    timezone: string;
  };
  settings: { timesheets: { reasons: string[] } };
  people: SeedPerson[];
  teams: { name: string; members: string[]; teamManager: string | null }[];
  projects: SeedProject[];
  apps: {
    name: string;
    kind: 'app' | 'site';
    label: 'Core' | 'Non-core' | 'Unclassified';
  }[];
};

const ORG_ROLES: Record<SeedPerson['orgRole'], MembershipRole> = {
  admin: MembershipRole.ADMIN,
  manager: MembershipRole.MANAGER,
  member: MembershipRole.MEMBER,
};

const PROJECT_ROLES: Record<
  SeedProject['members'][number]['role'],
  ProjectMembershipRole
> = {
  Manager: ProjectMembershipRole.MANAGER,
  Member: ProjectMembershipRole.MEMBER,
  Viewer: ProjectMembershipRole.VIEWER,
};

const TASK_STAGES: Record<SeedTask['stage'], TaskStage> = {
  'To do': TaskStage.TODO,
  'In progress': TaskStage.IN_PROGRESS,
  Done: TaskStage.DONE,
};

/** The tracking choices the guide's step 2 recommends, as stored in
 * `organisations.settings`. */
const TRACKING_SETTINGS = {
  appUrlTracking: 'apps_urls',
  windowTrackingEnabled: true,
  activityTrackingEnabled: true,
  membersCanViewOwnActivity: true,
  screenshotsEnabled: true,
  screenshotFrequencySeconds: 600,
  screenshotRetentionDays: 90,
  membersCanDeleteScreenshots: false,
  idleThresholdMinutes: 5,
  idleHandling: 'flag',
  timesheetModifyTime: 'add_edit',
  timesheetRequireReason: true,
  projectsEnabled: true,
};

/** Same two checks as `seed-test-accounts.ts`: the host check misses a
 * tunnel to production, NODE_ENV catches it. */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      'Refusing to seed: DATABASE_URL does not point at localhost.',
    );
  }
}

function loadSeed(): Seed {
  return JSON.parse(readFileSync(SEED_PATH, 'utf8')) as Seed;
}

/**
 * Deletes the rows `idsSql` selects from `table`, after every row that
 * points at them. Walks the foreign keys from the catalogue instead of
 * listing tables by hand, so a table added later is still cleaned up.
 */
async function deleteWithDependants(
  runner: QueryRunner,
  table: string,
  idsSql: string,
  params: unknown[],
  depth = 0,
): Promise<void> {
  if (depth > 10) throw new Error(`Foreign keys nest too deep at ${table}.`);

  const children = (await runner.query(
    `SELECT cl.relname AS child, att.attname AS column, c.confdeltype AS action
         FROM pg_constraint c
         JOIN pg_class cl ON cl.oid = c.conrelid
         JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = $1::regclass`,
    [`"${table}"`],
  )) as { child: string; column: string; action: string }[];

  for (const { child, column, action } of children) {
    // 'c' cascades and 'n' / 'd' set a value: the database handles those.
    if (action === 'c' || action === 'n' || action === 'd') continue;
    if (child === table) continue;
    await deleteWithDependants(
      runner,
      child,
      `SELECT id FROM "${child}" WHERE "${column}" IN (${idsSql})`,
      params,
      depth + 1,
    );
  }

  await runner.query(`DELETE FROM "${table}" WHERE id IN (${idsSql})`, params);
}

async function clean(seed: Seed): Promise<void> {
  const emails = seed.people.map((person) => person.email);
  const runner = dataSource.createQueryRunner();
  await runner.startTransaction();
  try {
    const organisations = (await runner.query(
      `SELECT DISTINCT o.id, o.name FROM organisations o
         JOIN memberships m ON m."organisationId" = o.id
         JOIN users u ON u.id = m."userId"
        WHERE u.email = ANY($1)`,
      [emails],
    )) as { id: string; name: string }[];

    for (const organisation of organisations) {
      await runner.query(
        `UPDATE organisations SET "ownerUserId" = NULL WHERE id = $1`,
        [organisation.id],
      );
      await deleteWithDependants(runner, 'organisations', 'SELECT $1::uuid', [
        organisation.id,
      ]);
      console.log(`Removed organisation: ${organisation.name}`);
    }

    // Only people left with no organisation at all.
    await deleteWithDependants(
      runner,
      'users',
      `SELECT u.id FROM users u WHERE u.email = ANY($1)
         AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m."userId" = u.id)`,
      [emails],
    );

    await runner.commitTransaction();
    console.log(
      organisations.length === 0
        ? 'Nothing seeded to remove.'
        : 'Removed the seed people.',
    );
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

async function create(
  manager: EntityManager,
  seed: Seed,
): Promise<SeedContext> {
  const passwordHash = await argon2.hash(PASSWORD);
  const now = new Date();

  const users = new Map<string, User>();
  for (const person of seed.people) {
    users.set(
      person.key,
      await manager.save(
        manager.create(User, {
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          name: `${person.firstName} ${person.lastName}`,
          passwordHash,
          emailVerifiedAt: now,
        }),
      ),
    );
  }

  const owner = seed.people.find((person) => person.orgRole === 'admin');
  if (!owner) throw new Error('seed.json needs one admin.');

  const organisation = await manager.save(
    manager.create(Organisation, {
      name: seed.organisation.name,
      slug: generateSlug(seed.organisation.name),
      region: OrganisationRegion.US,
      ownerUserId: users.get(owner.key)!.id,
      settings: {
        timezone: seed.organisation.timezone,
        currency: 'USD',
        address: seed.organisation.address,
        website: seed.organisation.website,
        ...TRACKING_SETTINGS,
      },
    }),
  );
  const organisationId = organisation.id;

  // What sign-up creates alongside every organisation.
  await manager.save(manager.create(Team, { name: 'General', organisationId }));
  await manager.save(
    seed.settings.timesheets.reasons.map((label) =>
      manager.create(TimesheetReason, { organisationId, label }),
    ),
  );
  if (process.env.BILLING_ENABLED === 'true') {
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await manager.save(
      manager.create(Subscription, {
        organisationId,
        status: SubscriptionStatus.TRIALING,
        trialStartedAt: now,
        trialEndsAt,
        trialReminderSentAtDaysLeft: null,
      }),
    );
  }

  const memberships = new Map<string, Membership>();
  for (const person of seed.people) {
    memberships.set(
      person.key,
      await manager.save(
        manager.create(Membership, {
          userId: users.get(person.key)!.id,
          organisationId,
          role: ORG_ROLES[person.orgRole],
          status: MembershipStatus.ACTIVE,
        }),
      ),
    );
  }
  const membershipOf = (key: string): Membership => {
    const membership = memberships.get(key);
    if (!membership) throw new Error(`Unknown person in seed.json: ${key}`);
    return membership;
  };

  const teams = new Map<string, Team>();
  for (const seedTeam of seed.teams) {
    const team = await manager.save(
      manager.create(Team, { name: seedTeam.name, organisationId }),
    );
    teams.set(seedTeam.name, team);
    await manager.save(
      seedTeam.members.map((key) =>
        manager.create(TeamMembership, {
          teamId: team.id,
          membershipId: membershipOf(key).id,
          isManager: seedTeam.teamManager === key,
        }),
      ),
    );
  }

  const projects: SeedContext['projects'] = new Map();
  for (const seedProject of seed.projects) {
    const project = await manager.save(
      manager.create(Project, {
        name: seedProject.name,
        description: seedProject.description,
        colour: seedProject.colour as ProjectColour,
        organisationId,
      }),
    );

    await manager.save(
      seedProject.teams.map((name) => {
        const team = teams.get(name);
        if (!team) throw new Error(`Unknown team in seed.json: ${name}`);
        return manager.create(ProjectTeam, {
          projectId: project.id,
          teamId: team.id,
        });
      }),
    );

    // A task's assignee is a project membership, so everyone with a task
    // is also added to the project directly, as a Member unless the seed
    // says otherwise.
    const projectRoles = new Map<string, ProjectMembershipRole>();
    for (const task of seedProject.tasks) {
      projectRoles.set(task.assignee, ProjectMembershipRole.MEMBER);
    }
    for (const member of seedProject.members) {
      projectRoles.set(member.person, PROJECT_ROLES[member.role]);
    }
    const projectMemberships = new Map<string, ProjectMembership>();
    for (const [key, role] of projectRoles) {
      projectMemberships.set(
        key,
        await manager.save(
          manager.create(ProjectMembership, {
            projectId: project.id,
            membershipId: membershipOf(key).id,
            role,
          }),
        ),
      );
    }

    const tasks = await manager.save(
      seedProject.tasks.map((task) =>
        manager.create(Task, {
          name: task.name,
          projectId: project.id,
          // Numeric column, read back as a string.
          estimate: String(task.estimateHours),
          stage: TASK_STAGES[task.stage],
          closedAt: task.stage === 'Done' ? now : null,
          assigneeProjectMembershipId: projectMemberships.get(task.assignee)!
            .id,
        }),
      ),
    );
    projects.set(seedProject.name, {
      id: project.id,
      tasks: tasks.map((task, index) => ({
        id: task.id,
        assignee: seedProject.tasks[index].assignee,
      })),
    });
  }

  // Unclassified is the absence of a label, so it gets no row.
  await manager.save(
    seed.apps
      .filter((app) => app.label !== 'Unclassified')
      .map((app) =>
        manager.create(WorkClassification, {
          organisationId,
          kind: app.kind,
          name: app.name,
          label: app.label === 'Core' ? 'core' : 'non_core',
        }),
      ),
  );

  console.log(`Created organisation: ${organisation.name}`);
  for (const person of seed.people) {
    console.log(`  ${person.orgRole.padEnd(8)} ${person.email}`);
  }
  console.log(`Password for all of them: ${PASSWORD}`);

  return {
    organisationId,
    people: new Map(
      seed.people.map((person) => [
        person.key,
        {
          membershipId: membershipOf(person.key).id,
          userId: users.get(person.key)!.id,
        },
      ]),
    ),
    projects,
  };
}

async function main(): Promise<void> {
  assertNotProduction();
  const seed = loadSeed();
  await dataSource.initialize();

  try {
    if (process.argv.includes('--clean')) {
      await clean(seed);
      return;
    }

    const existing = await dataSource.getRepository(User).find({
      where: { email: In(seed.people.map((person) => person.email)) },
    });
    if (existing.length > 0) {
      throw new Error(
        `Seed people already exist (${existing.map((user) => user.email).join(', ')}). ` +
          'Run with --clean first. That removes every organisation they belong to, with all its data.',
      );
    }

    await dataSource.transaction(async (manager) => {
      const now = new Date();
      const context = await create(manager, seed);
      await seedHistory(manager, seed, context, now);
    });
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
