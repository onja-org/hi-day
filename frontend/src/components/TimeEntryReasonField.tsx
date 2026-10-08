type TimeEntryReasonFieldProps = {
  /** Reaches the form's FormData under this name. */
  name?: string;
};

/** Why a time entry is being changed; kept on the audit row and shown in the Manual time edits report. */
export function TimeEntryReasonField({ name = "reason" }: TimeEntryReasonFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-900">Reason*</span>
      <textarea
        name={name}
        rows={3}
        maxLength={500}
        required
        placeholder="Why are you changing this time entry? (ex: Forgot to stop timer)"
        className="w-full rounded-brand-sm border-2 border-ink bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
