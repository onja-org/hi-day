import { InfoIcon } from "@phosphor-icons/react";
import { describeNormalPatterns } from "@/lib/describeNormalPatterns";
import type { UnusualRule } from "@/types/unusualActivity";

type UnusualActivityNormalNoteProps = {
  rules: UnusualRule[];
  ownPage: boolean;
};

/** Which patterns were left out as this member's normal; renders nothing when none were. */
export function UnusualActivityNormalNote({ rules, ownPage }: UnusualActivityNormalNoteProps) {
  const note = describeNormalPatterns(rules, ownPage);
  if (!note) return null;

  return (
    <p className="flex items-start gap-2 rounded-brand-sm border border-input-border bg-white p-4 text-sm text-slate-900">
      <InfoIcon size={20} aria-hidden="true" className="shrink-0 text-primary-dark" />
      {note}
    </p>
  );
}
