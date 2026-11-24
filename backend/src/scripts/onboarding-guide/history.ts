import { readFileSync } from 'fs';
import { join } from 'path';
import { EntityManager } from 'typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Device } from '../../database/entities/device.entity';
import { DevicePlatform } from '../../database/entities/device-platform.enum';
import { Note } from '../../database/entities/note.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import { TimeEntryType } from '../../database/entities/time-entry-type.enum';

/**
 * Part 2 of the onboarding-guide seed: about two months of plausible work
 * history, so Reports, Timeline, Performance, Unusual activity and Highlights
 * have something to show. Everything is generated from the patterns in
 * `seed.json` with a fixed random seed, so a re-run gives the same story
 * shifted to the day it runs.
 *
 * No screenshots: those live in object storage, and the guide takes real
 * ones from a paired desktop app on the day instead.
 */

type Weights = Record<string, number>;

type PersonSchedule = {
  start: string;
  end: string;
  jitterMinutes: number;
  sources: Weights;
  activity: [number, number];
  apps: Weights;
  sites: Weights;
};

export type HistorySeed = {
  organisation: { timezone: string };
  windowTitles: Record<string, string[] | string>;
  history: {
    range: { fromDayOffset: number; toDayOffset: number };
    randomSeed: number;
    people: Record<string, PersonSchedule | string>;
    siteTitles: Record<string, string[]>;
    normalDay: { projectMix: Record<string, Weights> };
    manualEdits: {
      person: string;
      dayOffset: number;
      action: 'add' | 'edit';
      from?: string;
      to?: string;
      project?: string;
      reason: string;
    }[];
    oddDays: {
      items: { person: string; dayOffset: number; kind: string }[];
    };
    behaviourChange: { person: string; fromDayOffset: number };
  };
  notes: {
    person: string;
    dayOffset: number;
    project: string;
    content: string;
  }[];
};

export type SeedContext = {
  organisationId: string;
  people: Map<string, { membershipId: string; userId: string }>;
  projects: Map<
    string,
    { id: string; tasks: { id: string; assignee: string }[] }
  >;
};

/** A stretch of work on one local day, in minutes after local midnight. */
type Span = {
  start: number;
  end: number;
  project: string;
  source: 'agent' | 'web' | 'manual';
  /** Minutes of kept idle time at the start (a `resumed` entry). */
  idleMinutes: number;
  activity: [number, number];
  /** Same activity and window for the whole span: the "flat" odd day. */
  flat?: boolean;
  /** Still running at the moment the seed runs. */
  running?: boolean;
  /** For the "edit" manual change: where the span ended before the edit. */
  editedFromEnd?: number;
  reason?: string;
  /** Minutes of the day at 95–99% activity: the high-activity odd day. */
  burst?: [number, number];
};

type AppBlock = {
  membershipId: string;
  deviceId: string;
  app: string;
  title: string;
  start: Date;
  end: Date;
  site?: string;
};

const DESKTOP_PLATFORMS: Record<string, DevicePlatform> = {
  tiana: DevicePlatform.MACOS,
  lucas: DevicePlatform.MACOS,
  hery: DevicePlatform.LINUX,
  sofia: DevicePlatform.WINDOWS,
};

const OTHER_TITLES: Record<string, string> = {
  Terminal: 'zsh — tamarind-steps-site',
  Spotify: 'Spotify',
};

/** Small, seedable PRNG so every run makes the same history. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function minutes(clock: string): number {
  const [hours, mins] = clock.split(':').map(Number);
  return hours * 60 + mins;
}

/** Offset of `timeZone` from UTC at `at`, in minutes (east is positive). */
function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? '');
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export async function seedHistory(
  manager: EntityManager,
  seed: HistorySeed,
  context: SeedContext,
  now: Date,
): Promise<void> {
  const rng = mulberry32(seed.history.randomSeed);
  const between = (low: number, high: number) =>
    low + Math.round(rng() * (high - low));
  const pick = (weights: Weights): string => {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  };
  const oneOf = <T>(items: T[]): T => items[Math.floor(rng() * items.length)];

  const timeZone = seed.organisation.timezone;
  const offset = zoneOffsetMinutes(timeZone, now);
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  const [year, month, day] = todayKey.split('-').map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  const nowMinutes = Math.floor(
    (now.getTime() - (todayUtc - offset * 60_000)) / 60_000,
  );

  const dayKey = (dayOffset: number) =>
    new Date(todayUtc + dayOffset * 86_400_000).toISOString().slice(0, 10);
  const weekday = (dayOffset: number) =>
    new Date(todayUtc + dayOffset * 86_400_000).getUTCDay();
  const isWorkday = (dayOffset: number) =>
    weekday(dayOffset) !== 0 && weekday(dayOffset) !== 6;
  /** Moves a relative day back to the nearest weekday. */
  const toWorkday = (dayOffset: number) => {
    let shifted = dayOffset;
    while (!isWorkday(shifted)) shifted -= 1;
    return shifted;
  };
  const at = (dayOffset: number, minute: number) =>
    new Date(todayUtc + dayOffset * 86_400_000 + (minute - offset) * 60_000);

  const desktopVersion = (() => {
    try {
      const file = join(__dirname, '../../../../desktop/package.json');
      return (JSON.parse(readFileSync(file, 'utf8')) as { version: string })
        .version;
    } catch {
      return '0.4.3';
    }
  })();

  const schedules = Object.entries(seed.history.people).filter(
    (entry): entry is [string, PersonSchedule] => typeof entry[1] !== 'string',
  );

  // One desktop app per person who uses it.
  const devices = new Map<string, Device>();
  for (const [key, schedule] of schedules) {
    if (!schedule.sources.agent) continue;
    const person = context.people.get(key)!;
    devices.set(
      key,
      await manager.save(
        manager.create(Device, {
          organisationId: context.organisationId,
          userId: person.userId,
          deviceFingerprint: `onboarding-guide-seed-${key}`,
          platform: DESKTOP_PLATFORMS[key] ?? DevicePlatform.MACOS,
          hostname: `${key}-laptop`,
          appVersion: desktopVersion,
          appCaptureStatus: 'ok',
          urlCaptureStatus: 'ok',
        } as Partial<Device>),
      ),
    );
  }

  const odd = new Map<string, string>();
  for (const item of seed.history.oddDays.items) {
    const dayOffset =
      item.kind === 'weekend work'
        ? (() => {
            let shifted = item.dayOffset;
            while (weekday(shifted) !== 6) shifted -= 1;
            return shifted;
          })()
        : toWorkday(item.dayOffset);
    odd.set(`${item.person}:${dayOffset}`, item.kind);
  }
  const manualByDay = new Map<string, HistorySeed['history']['manualEdits']>();
  for (const edit of seed.history.manualEdits) {
    const keyed = `${edit.person}:${toWorkday(edit.dayOffset)}`;
    manualByDay.set(keyed, [...(manualByDay.get(keyed) ?? []), edit]);
  }

  const planNormalDay = (
    schedule: PersonSchedule,
    mix: Weights,
    changed: boolean,
  ): Span[] => {
    const jitter = () =>
      between(-schedule.jitterMinutes, schedule.jitterMinutes);
    const start = (changed ? 600 : minutes(schedule.start)) + jitter();
    const end = (changed ? 1080 : minutes(schedule.end)) + jitter();
    const lunch = 750 + between(-15, 15);
    const lunchEnd = lunch + between(45, 60);
    const activity: [number, number] = changed ? [25, 55] : schedule.activity;

    const blocks: [number, number][] = [];
    if (start < lunch) blocks.push([start, Math.min(lunch, end)]);
    if (end > lunchEnd) blocks.push([Math.max(lunchEnd, start), end]);

    const spans: Span[] = [];
    for (const [blockStart, blockEnd] of blocks) {
      if (blockEnd - blockStart < 20) continue;
      const pieces: [number, number][] =
        blockEnd - blockStart > 150
          ? (() => {
              const split =
                blockStart + between(60, blockEnd - blockStart - 60);
              return [
                [blockStart, split],
                [split + between(5, 15), blockEnd],
              ];
            })()
          : [[blockStart, blockEnd]];
      for (const [pieceStart, pieceEnd] of pieces) {
        spans.push({
          start: pieceStart,
          end: pieceEnd,
          project: pick(mix),
          source: pick(schedule.sources) as Span['source'],
          idleMinutes: 0,
          activity,
        });
      }
    }

    // About one idle stretch every three days, kept or discarded.
    const long = spans.filter(
      (span) => span.source === 'agent' && span.end - span.start > 60,
    );
    if (long.length > 0 && rng() < 0.3) {
      const span = oneOf(long);
      const idleStart = span.start + between(20, span.end - span.start - 25);
      const idleLength = between(5, 15);
      const rest: Span = { ...span, start: idleStart, idleMinutes: idleLength };
      if (rng() >= 0.5) {
        // Discarded: the idle stretch is simply not there.
        rest.start = idleStart + idleLength;
        rest.idleMinutes = 0;
      }
      span.end = idleStart;
      spans.splice(spans.indexOf(span) + 1, 0, rest);
    }
    return spans;
  };

  const entries: Partial<TimeEntry>[] = [];
  const entryMeta: { person: string; dayOffset: number; span: Span }[] = [];
  const samples: Partial<ActivitySample>[] = [];
  const blocks: AppBlock[] = [];

  const { fromDayOffset, toDayOffset } = seed.history.range;
  for (const [key, schedule] of schedules) {
    const person = context.people.get(key)!;
    const device = devices.get(key);
    const mix = seed.history.normalDay.projectMix[key] ?? {};
    const tasksFor = (projectName: string) =>
      (context.projects.get(projectName)?.tasks ?? []).filter(
        (task) => task.assignee === key,
      );

    for (
      let dayOffset = fromDayOffset;
      dayOffset <= toDayOffset;
      dayOffset += 1
    ) {
      const kind = odd.get(`${key}:${dayOffset}`);
      if (!isWorkday(dayOffset) && kind !== 'weekend work') continue;

      const changed =
        key === seed.history.behaviourChange.person &&
        dayOffset >= seed.history.behaviourChange.fromDayOffset;
      let spans: Span[];
      if (kind === 'long stretch without a break') {
        spans = [
          {
            start: 510,
            end: 1185,
            project: 'Tamarind Steps Café: Website redesign',
            source: 'agent',
            idleMinutes: 0,
            activity: [60, 80],
            burst: [840, 890],
          },
        ];
      } else if (kind === 'weekend work') {
        spans = [
          {
            start: 600,
            end: 780,
            project: 'Tamarind Steps Café: Website redesign',
            source: 'agent',
            idleMinutes: 0,
            activity: schedule.activity,
          },
        ];
      } else {
        spans = planNormalDay(schedule, mix, changed);
        if (kind === 'suspiciously flat activity') {
          spans = spans.filter((span) => span.end <= 600 || span.start >= 780);
          spans.push({
            start: 600,
            end: 780,
            project: 'Tamarind Steps Café: Website redesign',
            source: 'agent',
            idleMinutes: 0,
            activity: [50, 50],
            flat: true,
          });
        }
        if (kind === 'very late finish') {
          spans.push({
            start: 1170,
            end: 1390,
            project: 'Tamarind Steps Café: Website redesign',
            source: 'agent',
            idleMinutes: 0,
            activity: [35, 60],
          });
        }
      }

      // Time added by hand replaces whatever was tracked in that window.
      for (const edit of manualByDay.get(`${key}:${dayOffset}`) ?? []) {
        if (edit.action === 'add' && edit.from && edit.to && edit.project) {
          const from = minutes(edit.from);
          const to = minutes(edit.to);
          spans = spans.flatMap((span) => {
            if (span.end <= from || span.start >= to) return [span];
            const parts: Span[] = [];
            if (span.start < from) parts.push({ ...span, end: from });
            if (span.end > to) {
              parts.push({ ...span, start: to, idleMinutes: 0 });
            }
            return parts;
          });
          spans.push({
            start: from,
            end: to,
            project: edit.project,
            source: 'manual',
            idleMinutes: 0,
            activity: [0, 0],
            reason: edit.reason,
          });
        } else if (edit.action === 'edit') {
          const last = [...spans]
            .filter((span) => span.source === 'agent')
            .pop();
          if (last) {
            last.editedFromEnd = last.end + 40;
            last.reason = edit.reason;
          }
        }
      }

      // Today: only what has happened so far. The last entry of whoever
      // uses the web timer is left running.
      if (dayOffset === 0) {
        spans = spans
          .filter((span) => span.start < nowMinutes - 5)
          .map((span) => {
            if (span.end <= nowMinutes) return span;
            if (key === 'hery') {
              return { ...span, source: 'web', running: true };
            }
            return { ...span, end: nowMinutes - 2 };
          });
      }

      spans.sort((a, b) => a.start - b.start);
      for (const span of spans) {
        if (span.end - span.start < 5 && !span.running) continue;
        const usesDevice = span.source === 'agent' && device !== undefined;
        const tasks = tasksFor(span.project);
        entries.push({
          organisationId: context.organisationId,
          membershipId: person.membershipId,
          projectId: context.projects.get(span.project)?.id ?? null,
          taskId: tasks.length > 0 && rng() < 0.7 ? oneOf(tasks).id : null,
          startedAt: at(dayOffset, span.start),
          endedAt: span.running ? null : at(dayOffset, span.end),
          lastSeenAt: span.running ? now : null,
          source:
            span.source === 'agent'
              ? TimeEntrySource.AGENT
              : span.source === 'web'
                ? TimeEntrySource.WEB
                : TimeEntrySource.MANUAL,
          type:
            span.source === 'manual'
              ? TimeEntryType.MANUAL
              : span.idleMinutes > 0
                ? TimeEntryType.RESUMED
                : TimeEntryType.NORMAL,
          idleSeconds: span.idleMinutes > 0 ? span.idleMinutes * 60 : null,
          deviceId: usesDevice ? device.id : null,
        });
        entryMeta.push({ person: key, dayOffset, span });

        if (!usesDevice) continue;

        // Activity, one sample per whole 10-minute period.
        for (
          let period = Math.ceil(span.start / 10) * 10;
          period + 10 <= span.end;
          period += 10
        ) {
          const idle = period < span.start + span.idleMinutes;
          const inBurst =
            span.burst !== undefined &&
            period >= span.burst[0] &&
            period + 10 <= span.burst[1];
          const active = span.flat
            ? 50
            : idle
              ? between(0, 3)
              : inBurst
                ? between(95, 99)
                : between(span.activity[0], span.activity[1]);
          samples.push({
            organisationId: context.organisationId,
            membershipId: person.membershipId,
            deviceId: device.id,
            activePercentage: active,
            periodStart: at(dayOffset, period),
            periodEnd: at(dayOffset, period + 10),
            keystrokes: span.flat ? 150 : Math.round(active * (2 + rng() * 4)),
            mouseClicks: span.flat ? 40 : Math.round(active * (0.4 + rng())),
            mouseMovement: span.flat
              ? 1500
              : Math.round(active * (15 + rng() * 45)),
          });
        }

        // Apps and websites, switching every few minutes.
        let cursor = span.start + span.idleMinutes;
        while (cursor < span.end) {
          const length = span.flat
            ? span.end - cursor
            : changed
              ? between(2, 8)
              : between(3, 20);
          const blockEnd = Math.min(cursor + length, span.end);
          const app = span.flat ? 'Visual Studio Code' : pick(schedule.apps);
          let title: string;
          let site: string | undefined;
          if (app === 'Google Chrome') {
            const sites = changed
              ? { ...schedule.sites, 'youtube.com': 0.35 }
              : schedule.sites;
            site = pick(sites);
            title = oneOf(seed.history.siteTitles[site] ?? [site]);
          } else {
            const titles = seed.windowTitles[app];
            title = span.flat
              ? 'ContactForm.tsx — tamarind-steps-site'
              : Array.isArray(titles)
                ? oneOf(titles)
                : (OTHER_TITLES[app] ?? app);
          }
          blocks.push({
            membershipId: person.membershipId,
            deviceId: device.id,
            app,
            title,
            site,
            start: at(dayOffset, cursor),
            end: at(dayOffset, blockEnd),
          });
          cursor = blockEnd;
        }
      }
    }
  }

  const savedEntries = await manager.save(
    entries.map((entry) => manager.create(TimeEntry, entry)),
    { chunk: 200 },
  );

  await manager.save(
    samples.map((sample) => manager.create(ActivitySample, sample)),
    { chunk: 1000 },
  );

  // One app event every 5 seconds, as the desktop app samples them.
  for (let index = 0; index < blocks.length; index += 500) {
    const chunk = blocks.slice(index, index + 500);
    await manager.query(
      `INSERT INTO app_events ("organisationId", "membershipId", "deviceId", "appName", title, "sampledAt")
       SELECT $1, b.m, b.d, b.app, b.title, sampled
         FROM unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::timestamptz[], $7::timestamptz[])
              AS b(m, d, app, title, s, e),
              generate_series(b.s, b.e - interval '5 seconds', interval '5 seconds') AS sampled`,
      [
        context.organisationId,
        chunk.map((block) => block.membershipId),
        chunk.map((block) => block.deviceId),
        chunk.map((block) => block.app),
        chunk.map((block) => block.title),
        chunk.map((block) => block.start.toISOString()),
        chunk.map((block) => block.end.toISOString()),
      ],
    );
  }

  const visits = blocks.filter((block) => block.site !== undefined);
  for (let index = 0; index < visits.length; index += 500) {
    const chunk = visits.slice(index, index + 500);
    await manager.query(
      `INSERT INTO url_sessions (id, "organisationId", "membershipId", "deviceId", url, host, path, title,
                                 browser, private, "startedAt", "endedAt", "activeMs", "tzOffsetMin", source, confidence)
       SELECT gen_random_uuid(), $1, v.m, v.d, 'https://' || v.host || '/', v.host, '/', v.title,
              'Google Chrome', false, v.s, v.e, v.active, $8, 'ax', 'exact'
         FROM unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::timestamptz[], $7::timestamptz[], $9::int[])
              AS v(m, d, host, title, s, e, active)`,
      [
        context.organisationId,
        chunk.map((visit) => visit.membershipId),
        chunk.map((visit) => visit.deviceId),
        chunk.map((visit) => visit.site),
        chunk.map((visit) => visit.title),
        chunk.map((visit) => visit.start.toISOString()),
        chunk.map((visit) => visit.end.toISOString()),
        offset,
        chunk.map((visit) =>
          Math.round((visit.end.getTime() - visit.start.getTime()) * 0.85),
        ),
      ],
    );
  }

  // Manual changes, with the audit rows the Manual time edits report reads.
  let manualChanges = 0;
  for (const [index, { person, dayOffset, span }] of entryMeta.entries()) {
    if (!span.reason) continue;
    const entry = savedEntries[index];
    const actor = context.people.get(person)!;
    const loggedAt = at(dayOffset, Math.max(span.end, 1050) + 10);
    const [action, metadata] =
      span.source === 'manual'
        ? [
            'time_entry.created_manually',
            {
              timeEntryId: entry.id,
              membershipId: actor.membershipId,
              projectId: entry.projectId,
              taskId: entry.taskId,
              startedAt: entry.startedAt,
              endedAt: entry.endedAt,
              reason: span.reason,
            },
          ]
        : [
            'time_entry.updated',
            {
              timeEntryId: entry.id,
              changed: {
                endedAt: {
                  from: at(dayOffset, span.editedFromEnd ?? span.end),
                  to: entry.endedAt,
                },
              },
              reason: span.reason,
            },
          ];
    await manager.query(
      `INSERT INTO audit_logs (action, metadata, "organisationId", "actorUserId", "createdAt")
       VALUES ($1, $2, $3, $4, $5)`,
      [
        action,
        JSON.stringify(metadata),
        context.organisationId,
        actor.userId,
        loggedAt.toISOString(),
      ],
    );
    manualChanges += 1;
  }

  for (const note of seed.notes) {
    await manager.save(
      manager.create(Note, {
        organisationId: context.organisationId,
        membershipId: context.people.get(note.person)!.membershipId,
        projectId: context.projects.get(note.project)?.id ?? null,
        noteDate: dayKey(toWorkday(note.dayOffset)),
        content: note.content,
      }),
    );
  }

  // Each desktop app was last seen at the end of its person's last entry.
  for (const device of devices.values()) {
    const last = savedEntries
      .filter((entry) => entry.deviceId === device.id && entry.endedAt)
      .map((entry) => entry.endedAt!.getTime())
      .reduce((latest, time) => Math.max(latest, time), 0);
    if (last > 0) {
      await manager.update(
        Device,
        { id: device.id },
        { lastSeenAt: new Date(last) },
      );
    }
  }

  const appEvents = blocks.reduce(
    (sum, block) =>
      sum + Math.max(0, (block.end.getTime() - block.start.getTime()) / 5000),
    0,
  );
  console.log(
    `History: ${savedEntries.length} time entries, ${samples.length} activity samples, ` +
      `${Math.round(appEvents)} app events, ${visits.length} website visits, ` +
      `${manualChanges} manual changes, ${seed.notes.length} notes, ${devices.size} desktop apps.`,
  );
}
