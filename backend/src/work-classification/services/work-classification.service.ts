import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Not, Repository } from 'typeorm';
import {
  appEventSampleAtSql,
  appEventSamplesJoinSql,
  expandAppEventSamples,
  runLookbackStart,
} from '../../common/app-event-samples.util';
import { AppEvent } from '../../database/entities/app-event.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import {
  WorkClassification,
  WorkItemKind,
  WorkLabel,
} from '../../database/entities/work-classification.entity';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { SetWorkLabelDto, WorkLabelChoice } from '../dto/set-work-label.dto';
import {
  APP_SAMPLE_SECONDS,
  labelKey,
  splitWorkTime,
  WorkLabels,
  WorkTimeSplit,
} from '../work-classification.util';

/** How far back the labelling list looks for apps and sites in use. */
export const USAGE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface WorkUsageItem {
  kind: WorkItemKind;
  name: string;
  /** Tracked time across the Organisation in the last `USAGE_DAYS` days. */
  secondsSpent: number;
  label: WorkLabelChoice;
}

@Injectable()
export class WorkClassificationService {
  constructor(
    @InjectRepository(WorkClassification)
    private readonly classifications: Repository<WorkClassification>,
    @InjectRepository(AppEvent)
    private readonly appEvents: Repository<AppEvent>,
    @InjectRepository(UrlSession)
    private readonly urlSessions: Repository<UrlSession>,
    private readonly dataSource: DataSource,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * Every app and site used on the timer across the Organisation lately,
   * most time first, each with its label — plus anything labelled but not
   * used lately, so a label can always be found and undone.
   */
  async listUsage(
    organisationId: string,
    now = new Date(),
  ): Promise<WorkUsageItem[]> {
    const since = new Date(now.getTime() - USAGE_DAYS * MS_PER_DAY);

    const [apps, sites, labels] = await Promise.all([
      // A reading only counts while a Time entry covers it, as on the
      // Apps tab — the agent samples off the timer too. Each row is expanded
      // into the samples it stands for first (see app-event-samples.util),
      // so coverage is judged per sample, never per run. $4 only lets the
      // index narrow the scan; the per-sample bound is $2.
      this.dataSource.query<{ name: string; seconds: string }[]>(
        `SELECT a."appName" AS "name", COUNT(*) * $3 AS "seconds"
         FROM "app_events" a
         ${appEventSamplesJoinSql('a')}
         WHERE a."organisationId" = $1 AND a."sampledAt" >= $4
           AND ${appEventSampleAtSql('a')} >= $2
           AND EXISTS (
             SELECT 1 FROM "time_entries" e
             WHERE e."organisationId" = $1
               AND e."membershipId" = a."membershipId"
               AND e."startedAt" <= ${appEventSampleAtSql('a')}
               AND (e."endedAt" IS NULL OR e."endedAt" > ${appEventSampleAtSql('a')})
           )
         GROUP BY a."appName"`,
        [organisationId, since, APP_SAMPLE_SECONDS, runLookbackStart(since)],
      ),
      // A visit's active time only grows while the timer runs.
      this.dataSource.query<{ name: string; seconds: string }[]>(
        `SELECT "host" AS "name", SUM("activeMs") / 1000 AS "seconds"
         FROM "url_sessions"
         WHERE "organisationId" = $1 AND "startedAt" >= $2 AND "url" <> ''
         GROUP BY "host"`,
        [organisationId, since],
      ),
      this.classifications.find({ where: { organisationId } }),
    ]);

    const items = new Map<string, WorkUsageItem>();
    const add = (kind: WorkItemKind, name: string, seconds: number) =>
      items.set(labelKey(kind, name), {
        kind,
        name,
        secondsSpent: Math.round(seconds),
        label: 'unclassified',
      });
    for (const row of apps) add('app', row.name, Number(row.seconds));
    for (const row of sites) add('site', row.name, Number(row.seconds));
    for (const row of labels) {
      const key = labelKey(row.kind, row.name);
      if (!items.has(key)) add(row.kind, row.name, 0);
      items.get(key)!.label = row.label;
    }

    return [...items.values()].sort(
      (a, b) => b.secondsSpent - a.secondsSpent || a.name.localeCompare(b.name),
    );
  }

  /** "unclassified" removes the label rather than storing a third value. */
  async setLabel(organisationId: string, dto: SetWorkLabelDto): Promise<void> {
    if (dto.label === 'unclassified') {
      await this.classifications.delete({
        organisationId,
        kind: dto.kind,
        name: dto.name,
      });
      return;
    }
    await this.classifications.upsert(
      {
        organisationId,
        kind: dto.kind,
        name: dto.name,
        label: dto.label,
      },
      ['organisationId', 'kind', 'name'],
    );
  }

  /**
   * One member's tracked app time in `[start, end)`, split by the
   * Organisation's current labels — so changing a label changes past
   * figures too.
   */
  async splitForMember(
    organisationId: string,
    membershipId: string,
    start: Date,
    end: Date,
  ): Promise<WorkTimeSplit> {
    const [runs, visits, entries, labels] = await Promise.all([
      this.appEvents.find({
        select: { appName: true, sampledAt: true, sampleCount: true },
        where: {
          organisationId,
          membershipId,
          // Far enough back to catch a run reaching into the window.
          sampledAt: Between(runLookbackStart(start), end),
        },
        order: { sampledAt: 'ASC' },
      }),
      this.urlSessions.find({
        select: { host: true, startedAt: true, endedAt: true },
        where: {
          organisationId,
          membershipId,
          url: Not(''),
          startedAt: Between(new Date(start.getTime() - MS_PER_DAY), end),
        },
        order: { startedAt: 'ASC' },
      }),
      this.timeEntriesService.listCoveringWindow(
        organisationId,
        membershipId,
        start,
        end,
      ),
      this.labelsFor(organisationId),
    ]);
    // One reading per sample: a merged run splits exactly as its samples
    // sent one by one would.
    const readings = expandAppEventSamples(runs, { start, end });
    return splitWorkTime(readings, visits, entries, labels);
  }

  private async labelsFor(organisationId: string): Promise<WorkLabels> {
    const rows = await this.classifications.find({ where: { organisationId } });
    return new Map(
      rows.map((row): [string, WorkLabel] => [
        labelKey(row.kind, row.name),
        row.label,
      ]),
    );
  }
}
