// 07e: Activity → Screenshots for Lucas, with made-up screens.
// Adds screenshot rows to the LOCAL database for Lucas's tracked time yesterday
// (one per 10 minutes, on his seeded desktop app), then answers the browser's
// image requests to storage with the local JPEGs from fake-screens.mjs.
// Nothing is uploaded to or downloaded from storage.
// The rows are removed by `seed:onboarding-guide --clean`, or by this script
// on its next run.
import { readFileSync } from 'node:fs';
import { BASE, FAKE_SCREENS as SCREENS, login, newPage, openBrowser, shot, sql } from './lib.mjs';

const ORG = sql(`select id from organisations where name = 'HiD''Art'`);
const PUBLIC = sql(`select "publicId" from organisations where id = '${ORG}'`);
const LUCAS = sql(`select m.id from memberships m join users u on u.id = m."userId"
                   where u.email = 'lucas@hid.example' and m."organisationId" = '${ORG}'`);

sql(`delete from screenshots where "organisationId" = '${ORG}' and "storageKey" like '%-guide-%'`);
// The day shown: yesterday, a full seeded day (today has a real desktop run
// whose screenshots never uploaded). Monday shows Friday instead.
const DAY = sql(`select to_char((now() at time zone 'Indian/Antananarivo')::date
                 - case extract(isodow from now() at time zone 'Indian/Antananarivo')::int when 1 then 3 when 7 then 2 else 1 end, 'YYYY-MM-DD')`);
const dayOffset = Number(sql(`select '${DAY}'::date - (now() at time zone 'Indian/Antananarivo')::date`));
// One per 10-minute period with tracked time on Lucas's seeded desktop app;
// the image follows the project he was on.
const inserted = sql(`
  with entries as (
    select te."deviceId", te."startedAt", te."endedAt", p.name as project
      from time_entries te join projects p on p.id = te."projectId" join devices d on d.id = te."deviceId"
     where te."membershipId" = '${LUCAS}' and d."deviceFingerprint" like 'onboarding-guide-seed-%'
       and (te."startedAt" at time zone 'Indian/Antananarivo')::date = '${DAY}' and te."endedAt" is not null),
  slots as (
    select e.*, slot from entries e,
      generate_series(date_trunc('hour', e."startedAt") + interval '10 min' * floor(extract(minute from e."startedAt") / 10),
                      e."endedAt", interval '10 min') as slot)
  insert into screenshots ("organisationId", "membershipId", "deviceId", "storageKey", "capturedAt", "keptUntil")
  select distinct on (slot) '${ORG}', '${LUCAS}', "deviceId",
         'screenshots/${ORG}/' || "deviceId" || '/' || floor(extract(epoch from slot) * 1000)::bigint || '-guide-' ||
           case when project like 'Brightmorrow%' then 'brightmorrow-booking'
                when extract(minute from slot)::int % 20 = 0 then 'tamarind-menu' else 'tamarind-home' end || '.jpg',
         least(greatest(slot + interval '3 min' + (extract(minute from slot)::int % 7) * interval '1 min',
                        "startedAt" + interval '1 min'), "endedAt" - interval '1 min'),
         now() + interval '90 days'
    from slots
   where least(slot + interval '10 min', "endedAt") - greatest(slot, "startedAt") >= interval '2 min'
   order by slot, "startedAt"
  returning 1`).split('\n').filter(Boolean).length;
console.log(`added ${inserted} screenshot rows for Lucas`);

const browser = await openBrowser();
const page = await newPage(browser);
await page.route(/wasabisys\.com/, (route) => {
  const match = /-guide-([a-z-]+)\.jpg/.exec(route.request().url());
  if (!match) return route.abort();
  return route.fulfill({ contentType: 'image/jpeg', body: readFileSync(`${SCREENS}${match[1]}.jpg`) });
});
await login(page, 'nadia');
await page.goto(`${BASE}/organisations/${PUBLIC}/activities/screenshots?membershipId=${LUCAS}&day=${dayOffset}`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
// Tall enough for the filters, the last (short) hour and one full hour.
await page.setViewportSize({ width: 1440, height: 1700 });
await page.waitForTimeout(800);
await shot(page, '07e-activity-screenshots');
await browser.close();
