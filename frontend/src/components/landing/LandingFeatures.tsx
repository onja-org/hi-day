import type { LandingFeature } from "@/types/landing";
import { LandingFeatureTabs } from "./LandingFeatureTabs";

// Every claim here is something the product does today — the numbers in
// each card are illustrative examples.
const FEATURES: LandingFeature[] = [
  {
    key: "time",
    tab: "Time tracking",
    title: "Like signing in at the front desk.",
    body: "One click starts the day in the desktop app or on the web. Hours land on the right project and task, ready for timesheets.",
    points: [
      "Desktop app for Windows, macOS and Linux",
      "Pause and pick up where you left off",
      "Idle time flagged for review, never silently removed",
    ],
    statsTitle: "Today by project",
    statsTotal: "6:42",
    stats: [
      { label: "Website redesign", value: "4:30", share: "large", tone: "sun" },
      { label: "Admin & meetings", value: "1:32", share: "medium", tone: "mint" },
      { label: "Training", value: "0:40", share: "small", tone: "volt" },
    ],
  },
  {
    key: "activity",
    tab: "Activity",
    title: "Where the day went, at a glance.",
    body: "See which apps and websites were in use while the timer ran, and how busy each hour was. Screenshots stay off unless your team switches them on.",
    points: [
      "Apps and websites, hour by hour",
      "Activity level for every stretch of tracked time",
      "Optional screenshots the person can see too",
    ],
    statsTitle: "Today's top apps",
    statsTotal: "5:45",
    stats: [
      { label: "Code editor", value: "2:40", share: "large", tone: "sun" },
      { label: "Design tool", value: "1:55", share: "medium", tone: "mint" },
      { label: "Browser", value: "1:10", share: "small", tone: "volt" },
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
    statsTotal: "31:20",
    stats: [
      { label: "Website redesign", value: "18:05", share: "large", tone: "sun" },
      { label: "Mobile launch", value: "9:15", share: "medium", tone: "mint" },
      { label: "Support", value: "4:00", share: "small", tone: "volt" },
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
      "Remove someone's access in one click; their history stays",
    ],
    statsTitle: "Team hours this week",
    statsTotal: "78:00",
    stats: [
      { label: "Design", value: "31:00", share: "large", tone: "sun" },
      { label: "Engineering", value: "28:00", share: "medium", tone: "mint" },
      { label: "Support", value: "19:00", share: "small", tone: "volt" },
    ],
  },
  {
    key: "reports",
    tab: "Reports",
    title: "Numbers you can hand over.",
    body: "Turn tracked time into timesheets and reports by person, project or team, then export them as CSV.",
    points: [
      "Daily totals and time & activity reports",
      "Timesheets by day, week or calendar",
      "One-click CSV export",
    ],
    statsTitle: "This week",
    statsTotal: "38:40",
    stats: [
      { label: "Monday", value: "8:05", share: "large", tone: "sun" },
      { label: "Tuesday", value: "7:40", share: "large", tone: "mint" },
      { label: "Wednesday", value: "4:10", share: "medium", tone: "volt" },
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
