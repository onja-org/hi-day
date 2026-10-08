import type { DashboardProjectTime, DashboardSummary } from "@/types/dashboardSummary";

/**
 * Today's time per project, the running timer included.
 *
 * `projectsToday` counts completed entries only, while `workedTodaySeconds`
 * also counts the running entry up to the poll — so the gap between the two
 * is the live time, credited to whichever project is running. Its name comes
 * from `projectsThisWeek`, which already includes the running entry.
 */
export function todayProjectTimes(
  summary: Pick<DashboardSummary, "projectsToday" | "projectsThisWeek" | "workedTodaySeconds">,
  runningProjectId: string | null,
): DashboardProjectTime[] {
  const rows = summary.projectsToday.map((project) => ({ ...project }));
  const completedSeconds = rows.reduce((sum, project) => sum + project.seconds, 0);
  const liveSeconds = Math.max(0, summary.workedTodaySeconds - completedSeconds);

  if (runningProjectId && liveSeconds > 0) {
    const running = rows.find((project) => project.projectId === runningProjectId);
    const weekRow = summary.projectsThisWeek.find((project) => project.projectId === runningProjectId);
    if (running) {
      running.seconds += liveSeconds;
    } else if (weekRow) {
      rows.push({ ...weekRow, seconds: liveSeconds });
    }
  }

  return rows.sort((a, b) => b.seconds - a.seconds);
}
