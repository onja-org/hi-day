/**
 * What the dialog says when the server refuses time tracked offline.
 *
 * Kept general on purpose: a refusal follows sleep, an idle timeout, a
 * pause while offline or a work limit alike, so naming one cause would
 * often be wrong. The date goes with the time because the refusal can
 * arrive a day later, on reconnect, and "1:23 AM" alone reads as today.
 *
 * When nothing is running any more the person is told so and offered a
 * way to start again: the refusal is often what ended their timer, and
 * an unexplained stopped timer is how a morning goes untracked.
 */
export interface RefusedTime {
  op: { type: "start" | "stop"; at: string };
  message: string;
}

export interface RefusedTimeNotice {
  title: string;
  body: string;
  offerResume: boolean;
}

export function formatRefusedAt(at: string): string {
  return new Date(at).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function refusedTimeNotice(
  refused: RefusedTime[],
  state: { timerStopped: boolean },
): RefusedTimeNotice {
  const lines = refused.map(
    (item) => `${formatRefusedAt(item.op.at)} — ${item.message}`,
  );
  const paragraphs = [lines.join("\n")];
  if (state.timerStopped) paragraphs.push("Your timer is stopped.");
  paragraphs.push(
    "You can add the missing time by hand from your timesheet in the web app.",
  );
  return {
    title: "Some of your time couldn't be saved",
    body: paragraphs.join("\n\n"),
    offerResume: state.timerStopped,
  };
}
