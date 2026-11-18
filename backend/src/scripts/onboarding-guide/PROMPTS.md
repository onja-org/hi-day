# Prompts for the example company

These are the prompts used with Claude to make the example company in `seed.json`, the history seed,
and the screenshots. Run them again when the UI changes and the screenshots need retaking.

Rules for every prompt:
- Everything is made up. No real customer, person or company data.
- Emails use the reserved `.example` domain.
- Local or staging only. On prod, Claude may only act through the normal app as the fake users,
  inside one throwaway organisation, and that organisation is deleted afterwards. No direct database
  writes or scripts against prod.

## 1. Generate the example company (`seed.json`)

> Make up a small example company for a "Getting Started" guide for hiday, a time-tracking and
> activity app. Return JSON. It needs:
> - One organisation: a small design and web studio, with a name, a fake address, a `.example`
>   website and a time zone.
> - People in every user type: one admin, one manager who is the team manager of one team,
>   two or three members, and one person who is a Viewer on a single project (a client contact).
>   First name, last name, `.example` email, organisation role, job title, team and team role.
> - Two teams.
> - Three projects named "Client: Project" (for example "Harbour Café: Website redesign"), each
>   with a short description, a colour from blue, green, amber, red, purple, teal, pink, gray,
>   the teams on it, and 3–6 tasks with an assignee, a stage (To do, In progress, Done) and an
>   estimate in hours.
> - The apps and websites each person would use, each labelled Core, Non-core or Unclassified.
> - Fake window titles for the main apps.
> - Two months of work history described as patterns: work days, start and end times, breaks,
>   activity levels, project mix per person, a few manual time edits with reasons, and a few
>   deliberately odd days (a very long stretch without a break, suspiciously flat activity, a very
>   late finish, weekend work) plus one person whose behaviour changes in the last two weeks.
> - A few short daily notes.
> - What is happening on the day the screenshots are taken.
> Use relative dates (days before the screenshot day), not calendar dates.

Changes made by hand after generating:
- Kept the cast used during the feature audit (Brightline Studio, Nadia, Tiana, Lucas, Hery,
  Sofia, Clara) so the notes and screenshots match.
- Development has no team manager on purpose: it shows that a manager oversees only the teams
  they manage.
- Odd days tuned to the app's unusual-activity rules (`backend/src/insights/unusual-activity.util.ts`)
  and moved inside Insights' default "last 7 days": Sofia's flat day and Lucas's long day with a
  45-minute burst at 95–99%. A late finish and weekend work aren't rules; they only show on Timeline.
- Exact hours, activity levels, app mix and website titles added under `history.people` and
  `history.siteTitles`, with a fixed `randomSeed`, so a re-run gives the same story.

## 2. Seed two months of history (local only)

> Using `seed.json`, write a script for the hi-day repo that creates this organisation in the
> local database and fills in the history: time entries, activity samples every 10 minutes,
> app and website usage, idle stretches, manual edits with reasons, notes and work time labels.
> No screenshots: they live in object storage; real ones come from a paired desktop app on the day. Dates are relative to the day the script runs.
> Local only: refuse to run unless `DATABASE_URL` points at localhost.

Result: `backend/src/scripts/seed-onboarding-guide.ts` (part 1) and
`backend/src/scripts/onboarding-guide/history.ts` (part 2). Run with
`pnpm --filter backend seed:onboarding-guide` (add `--clean` to remove it again).

## 3. Take the screenshots

> Log in as each person from `seed.json` and take the screenshots listed in the guide's
> feature map, one step at a time, at the same browser window size. Show each user type's view
> where it differs: admin settings, the manager's team dashboard, a member's personal view,
> the viewer on a project, and Insights as a manager and as a member. Don't blur anything.

Result: `screenshots/` next to this file (Playwright driving the installed Google Chrome,
1440×900 at 2×). Images go to `backend/guide-screenshots/` (gitignored), or `GUIDE_SCREENSHOT_DIR`.
Needs the frontend and backend running locally and `psql` on the PATH. From
`backend/src/scripts/onboarding-guide/screenshots/`, run in this order:
1. `pnpm --filter backend seed:onboarding-guide --clean`, then `node phaseA.mjs` (sign-up shots on an
   empty database).
2. `pnpm --filter backend seed:onboarding-guide --clean`, then `pnpm --filter backend seed:onboarding-guide`.
3. `node phaseB.mjs` (web shots; pass ids like `04a 07g` to retake only those).
4. Pair a desktop app as Lucas, then `node phaseC-05c.mjs`, `node phaseC.mjs`,
   `node fake-screens.mjs` and `node phaseC-07e.mjs`.
5. `node phaseD.mjs` last: it pays with the Stripe test card, which ends the trial
   (`phaseD-10d.mjs` retakes only 10d on an org that has already paid).

Desktop-app shots (05b, 05c2, 05d, 06c, 06e) are taken by hand with Alt + Print Screen.

07e uses made-up screens: local screenshot uploads to storage failed, so `fake-screens.mjs` renders
three design-tool screens (Harbour Café menu page and homepage, Lumo booking flow) and
`phaseC-07e.mjs` adds local screenshot rows for Lucas and serves those images to the browser in
place of storage. Nothing is uploaded.
