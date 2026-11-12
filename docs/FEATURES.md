# hiday features

hiday is a time tracking and activity monitoring app for remote and distributed teams. People track time from a web console or a desktop app, and managers see where the time went. It's open about what it records: admins choose what gets collected, and staff are told.

## Time tracking

- Start, pause and stop a timer on a project and task, from the web or the desktop app. Both stay in sync.
- Each device runs its own timer, and overlapping time across devices is only counted once.
- Add time by hand, or edit, split and merge entries. Admins decide who else is allowed to do this. Every change is logged, with an optional reason.
- Idle detection. When someone goes idle, the app can ask whether to keep the time, cut it automatically, or do nothing. Sleep counts as idle.
- Work time limits: expected work days and hours, plus caps on how much someone can track.
- The timer keeps working offline and syncs when the connection comes back.

## Activity tracking

This only happens in the desktop app, only while a timer is running, and each part can be switched on or off by the admin, for everyone or per person.

- Apps and window titles: which app was in front, and for how long.
- Websites: the address of the page in front, read straight from the browser. No browser extension is needed.
- Screenshots at a set interval, with a set retention period. Admins choose whether people can delete their own.
- Activity level: the share of each 10 minutes with keyboard or mouse use. It never records what was typed.

## Teams and projects

- Anyone can sign up and create an organisation. They become its admin.
- Invite people by email or with a join link.
- Roles: admin, manager, member and finance. Managers only see the teams they manage.
- Teams, with people in as many teams as needed.
- Projects with a client name, project members, and project roles (manager, member, viewer). Viewers can see a project but can't track time on it.
- Tasks inside projects, with assignees.
- Require someone to track time only from the desktop app.

## Timesheets and reports

- A personal dashboard, and a team dashboard for admins and managers.
- Timesheets for each person, viewable in different timezones.
- Activity pages for apps, websites, screenshots and notes. Notes are short updates people write about what they're working on.
- Reports: time and activity, daily totals, work sessions, apps and websites, and manual time edits.
- Build a custom report and save it for later.
- Export reports as CSV.

## Desktop app

- Runs on Windows, macOS and Linux.
- Signs in by pairing with the web console, so no password is typed into the app.
- Opens when the computer starts. It can also start the timer at the beginning of each working day, with one click to undo.
- Shows today's totals per project, and a tray icon while tracking is on.
- Admins see every paired device on the Devices page, including when capture isn't working on one.
- Updates itself on Windows and Linux (AppImage).

## Privacy and security

- A disclosure notice tells staff what is collected. Admins write the text, and hiday records that each person saw it.
- Nothing is captured unless a timer is running.
- Links that look like password resets or one-time logins are thrown away, not recorded.
- Login is email and password, with an optional CAPTCHA after repeated failures.
- Sign out of every device at once.
- An owner can delete the organisation. Data is removed after a waiting period, or straight away if they choose.

## Hosting and pricing

| | Self-hosted | hiday Cloud |
| --- | --- | --- |
| Price | Free, any team size | $4 per person a month, or $42 a year |
| Trial | None needed | 14 days, no card |
| Setup | Docker Compose on your own server ([guide](SELF_HOSTING.md)) | Sign up at hiday.io |

Email and screenshot storage are optional when self-hosting. Without email, invite and password links show up in the server log instead. hiday is open source under AGPL-3.0.

## Not built yet

These are planned but don't exist today:

- Timesheet approval. The settings are there but greyed out.
- Payroll and client invoicing.
- Billable rates on projects.
- Locking the desktop app so staff can't quit it on company devices.
- Single sign-on (SSO).
- A mobile app.
- A guided setup checklist for new companies.
