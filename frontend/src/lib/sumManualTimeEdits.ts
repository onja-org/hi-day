import type { ManualTimeEdit } from "@/types/manualTimeEdit";

/** Time the edits put onto timesheets (adds, and edits that lengthened one) and took off them (deletes, and edits that shortened one). */
export function sumManualTimeEdits(edits: ManualTimeEdit[]): { addedSeconds: number; deletedSeconds: number } {
  let addedSeconds = 0;
  let deletedSeconds = 0;
  for (const edit of edits) {
    if (edit.changeSeconds > 0) addedSeconds += edit.changeSeconds;
    else deletedSeconds -= edit.changeSeconds;
  }
  return { addedSeconds, deletedSeconds };
}
