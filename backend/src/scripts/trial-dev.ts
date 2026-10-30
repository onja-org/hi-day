import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { TrialService } from '../billing/services/trial.service';
import {
  MS_PER_DAY,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS_LEFT,
} from '../billing/trial';
import { Organisation } from '../database/entities/organisation.entity';
import { Subscription } from '../database/entities/subscription.entity';

/**
 * Drives an Organisation's trial by hand, so the banner, the reminder emails
 * and the end of a trial can all be seen without waiting a fortnight or an
 * hour for the cron.
 *
 *   pnpm --filter backend trial:dev                                 list every trial
 *   pnpm --filter backend trial:dev --org 100018 --start            a real trial, as signup makes it
 *   pnpm --filter backend trial:dev --org 100018 --days-left 3      slide it to 3 days left
 *   pnpm --filter backend trial:dev --org 100018 --send-reminders   run the sweep now
 *   pnpm --filter backend trial:dev --org 100018 --clear            remove the trial
 *
 * `--days-left` takes negative numbers too, for the expired banner.
 * `--send-reminders` sends real email to the owner — see `--dry-run`.
 *
 * Excluded from the production build (see tsconfig.build.json) and refuses to
 * run against production or a non-local database: it rewrites billing dates
 * and sends mail, neither of which belongs anywhere shared.
 */

function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run: NODE_ENV is production. This rewrites trial dates and sends email.',
    );
  }

  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      'Refusing to run: DATABASE_URL does not point at localhost. This rewrites trial dates and sends email.',
    );
  }
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  assertNotProduction();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);
  const trials = app.get(TrialService);
  const organisations: Repository<Organisation> = app.get(
    getRepositoryToken(Organisation),
  );
  const subscriptions: Repository<Subscription> = app.get(
    getRepositoryToken(Subscription),
  );

  const orgFlag = flag('org');
  const organisation = orgFlag
    ? await organisations.findOne({
        where: Number.isInteger(Number(orgFlag))
          ? { publicId: Number(orgFlag) }
          : { name: orgFlag },
        relations: { owner: true },
      })
    : null;

  if (orgFlag && !organisation) {
    throw new Error(`No organisation matching --org ${orgFlag}`);
  }

  if (organisation && has('clear')) {
    await subscriptions.delete({ organisationId: organisation.id });
    console.log(
      `${organisation.name} (${organisation.publicId}): trial cleared — back to no subscription at all.`,
    );
  }

  if (organisation && has('start')) {
    // Exactly what signup does — no date fiddling afterwards, so the trial
    // runs for however long TRIAL_DAYS currently means.
    await dataSource.transaction((manager: EntityManager) =>
      trials.startTrial(manager, organisation.id),
    );
    console.log(
      `${organisation.name} (${organisation.publicId}): started a real trial.`,
    );
  }

  const daysLeftFlag = flag('days-left');
  if (organisation && daysLeftFlag !== undefined) {
    const daysLeft = Number(daysLeftFlag);

    const existing = await subscriptions.findOne({
      where: { organisationId: organisation.id },
    });
    if (!existing) {
      // The same call signup makes, so this is a real trial, not a fake row.
      await dataSource.transaction((manager: EntityManager) =>
        trials.startTrial(manager, organisation.id),
      );
    }

    // Aim half a day inside the target so days-left (which rounds up) lands
    // on the number asked for rather than on a boundary.
    const trialEndsAt = new Date(Date.now() + (daysLeft - 0.5) * MS_PER_DAY);
    await subscriptions.update(
      { organisationId: organisation.id },
      {
        trialStartedAt: new Date(
          trialEndsAt.getTime() - TRIAL_DAYS * MS_PER_DAY,
        ),
        trialEndsAt,
        // Re-arm the reminders, so the same org can be used to test a
        // milestone more than once.
        trialReminderSentAtDaysLeft: null,
      },
    );
  }

  if (organisation && has('send-reminders')) {
    const subscription = await subscriptions.findOneOrFail({
      where: { organisationId: organisation.id },
    });
    const status = await trials.findStatus(organisation.id);
    console.log(
      `Sweeping with ${status?.daysLeft} day(s) left; milestones are ${TRIAL_REMINDER_DAYS_LEFT.join(', ')}.`,
    );
    console.log(
      `Owner is ${organisation.owner?.email ?? '(none — nothing will send)'}`,
    );

    if (has('dry-run')) {
      console.log('--dry-run: not sending.');
    } else {
      await trials.sendDueTrialReminders();
      const after = await subscriptions.findOneOrFail({
        where: { id: subscription.id },
      });
      console.log(
        after.trialReminderSentAtDaysLeft ===
          subscription.trialReminderSentAtDaysLeft
          ? 'No milestone was due, so nothing was sent.'
          : `Sent the ${after.trialReminderSentAtDaysLeft}-day reminder.`,
      );
    }
  }

  const all = organisation
    ? [organisation]
    : await organisations.find({
        order: { publicId: 'ASC' },
        relations: { owner: true },
      });

  console.log('');
  for (const org of all) {
    const status = await trials.findStatus(org.id);
    const subscription = await subscriptions.findOne({
      where: { organisationId: org.id },
    });
    const line = `${String(org.publicId).padEnd(7)} ${org.name.padEnd(24)} `;

    if (!status) {
      console.log(`${line}no subscription (created before trials existed)`);
      continue;
    }

    console.log(
      line +
        `${status.isExpired ? 'EXPIRED' : `${status.daysLeft}d left`}`.padEnd(
          12,
        ) +
        `ends ${status.trialEndsAt.slice(0, 10)}  ` +
        `reminded: ${subscription?.trialReminderSentAtDaysLeft ?? '—'}  ` +
        `owner: ${org.owner?.email ?? '—'}`,
    );
  }

  await app.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
