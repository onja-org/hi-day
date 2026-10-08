import { Toggle } from "./Toggle";

type InviteLinkLimitFieldsProps = {
  expiryDate: string;
  onExpiryDateChange: (value: string) => void;
  usageCap: string;
  onUsageCapChange: (value: string) => void;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
};

/** When an invite link stops working: expiry date, usage cap, on/off. */
export function InviteLinkLimitFields({
  expiryDate,
  onExpiryDateChange,
  usageCap,
  onUsageCapChange,
  enabled,
  onEnabledChange,
}: InviteLinkLimitFieldsProps) {
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-slate-900">
          Expiration date
          <input
            type="date"
            value={expiryDate}
            min={today}
            onChange={(event) => onExpiryDateChange(event.target.value)}
            className="rounded-brand-sm border-2 border-ink px-3 h-11 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
          <span className="text-xs text-slate-900/60">Leave blank for no expiration.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-slate-900">
          Usage cap
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={usageCap}
            placeholder="∞ Unlimited"
            onChange={(event) => onUsageCapChange(event.target.value)}
            className="rounded-brand-sm border-2 border-ink px-3 h-11 text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
          <span className="text-xs text-slate-900/60">How many people can join through this link.</span>
        </label>
      </div>
      <Toggle
        name="enabled"
        label="Enabled"
        description="A disabled link stops accepting new join requests and pending ones can't be accepted."
        checked={enabled}
        onCheckedChange={onEnabledChange}
      />
    </div>
  );
}
