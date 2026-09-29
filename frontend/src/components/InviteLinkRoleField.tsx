import type { InviteLinkRole } from "@/types/inviteLink";

type InviteLinkRoleFieldProps = {
  value: InviteLinkRole;
  onChange: (role: InviteLinkRole) => void;
};

// A link never grants admin — see the backend's INVITE_LINK_ROLES.
const ROLE_OPTIONS: { value: InviteLinkRole; label: string; description: string }[] = [
  { value: "member", label: "Member", description: "Tracks their own time and sees only their own activity." },
  { value: "manager", label: "Manager", description: "Sees and manages the members of the teams they manage." },
];

export function InviteLinkRoleField({ value, onChange }: InviteLinkRoleFieldProps) {
  return (
    <fieldset className="flex flex-col gap-2 text-sm">
      <legend className="mb-2 text-slate-900">Role</legend>
      <div className="flex flex-wrap gap-5">
        {ROLE_OPTIONS.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 text-slate-900">
            <input
              type="radio"
              name="role"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-900/60">
        {ROLE_OPTIONS.find((option) => option.value === value)?.description}
      </p>
    </fieldset>
  );
}
