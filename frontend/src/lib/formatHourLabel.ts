export function formatHourLabel(hourStart: string): string {
  return new Date(hourStart).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
