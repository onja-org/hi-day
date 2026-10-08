import type { LandingFeature } from "@/types/landing";
import { LandingFeatureTabs } from "./LandingFeatureTabs";

// Every claim here is something the product does today. Each card is the
// app's own BrandStatCard (the dashboard's "at a glance" cards) fed example
// numbers, so it shows exactly what the real screen looks like.
const FEATURES: LandingFeature[] = [
  {
    key: "time",
    tab: "Time tracking",
    title: "Like signing in at the front desk.",
    body: "One click starts the day in the desktop app or on the web. Hours land on the right project and task, ready for timesheets.",
    points: [
      "Desktop app for Windows, macOS and Linux",
      "Pause and pick up where you left off",
      "Idle time flagged for review by default",
    ],
    statsTitle: "Today by project",
    stats: [
      { label: "Website redesign", seconds: 16200 },
      { label: "Admin & meetings", seconds: 5520 },
      { label: "Training", seconds: 2400 },
    ],
  },
  {
    key: "activity",
    tab: "Activity",
    title: "Where the day went, at a glance.",
    body: "See which apps and websites were in use while the timer ran, hour by hour, and how active each stretch of time was. Screenshots stay off unless your team switches them on.",
    points: [
      "Apps and websites, hour by hour",
      "Activity level for time tracked in the desktop app",
      "Optional screenshots the person can see too",
    ],
    statsTitle: "Today's top apps",
    stats: [
      { label: "Code editor", seconds: 9600 },
      { label: "Design tool", seconds: 6900 },
      { label: "Browser", seconds: 4200 },
    ],
  },
  {
    key: "projects",
    tab: "Projects & tasks",
    title: "Every hour has a home.",
    body: "Organise work into projects and tasks, add people or whole teams, and move tasks across a Kanban board.",
    points: [
      "Projects with their own members and teams",
      "List and Kanban views for tasks",
      "Time tracked straight against a task",
    ],
    statsTitle: "This week by project",
    stats: [
      { label: "Website redesign", seconds: 65100 },
      { label: "Mobile launch", seconds: 33300 },
      { label: "Support", seconds: 14400 },
    ],
  },
  {
    key: "teams",
    tab: "Teams & roles",
    title: "Everyone sees what they should.",
    body: "Group people into teams with their own managers. Admins see the whole organisation, managers see their teams, and members see themselves.",
    points: [
      "Admin, manager and member roles",
      "Invite by email, shareable link or CSV file",
      "Remove someone's access; their history stays",
    ],
    statsTitle: "Team hours this week",
    stats: [
      { label: "Design", seconds: 111600 },
      { label: "Engineering", seconds: 100800 },
      { label: "Support", seconds: 68400 },
    ],
  },
  {
    key: "reports",
    tab: "Reports",
    title: "Numbers you can hand over.",
    body: "Turn tracked time into timesheets and reports by person, project or team, then export them as CSV or PDF.",
    points: [
      "Daily totals and time & activity reports",
      "Timesheets by day, week or calendar",
      "Export to CSV or PDF",
    ],
    statsTitle: "This week",
    stats: [
      { label: "Monday", seconds: 29100 },
      { label: "Tuesday", seconds: 27600 },
      { label: "Wednesday", seconds: 15000 },
      { label: "Thursday", seconds: 34200 },
      { label: "Friday", seconds: 33300 },
    ],
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-b-3 border-ink">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <div className="flex max-w-180 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest text-ink-muted uppercase">
            Light-touch by design
          </span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">
            About what you&apos;d see in a normal office.
          </h2>
          <p className="text-lg text-ink-muted">
            Who&apos;s in, what they&apos;re working on and for how long. Hi Day sticks to the basics a
            team would notice in a typical office.
          </p>
        </div>
        <LandingFeatureTabs features={FEATURES} />
      </div>
    </section>
  );
}
