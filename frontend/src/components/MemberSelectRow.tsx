"use client";

type MemberSelectRowProps = {
  id: string;
  name: string | null;
  email: string;
  checked: boolean;
  role: "member" | "manager";
  /** e.g. "Team manager" vs. plain "Manager" — the only thing that differs
   * between the Projects and Teams add-member checklists. */
  managerLabel?: string;
  onCheckedChange: (checked: boolean) => void;
  onRoleChange: (role: "member" | "manager") => void;
};

/** One checkable candidate row, shared by the Projects and Teams "add
 * members" checklists — a checkbox plus that row's own role choice, so a
 * single batch submit can add some people as members and others as
 * managers together. */
export function MemberSelectRow({
  id,
  name,
  email,
  checked,
  role,
  managerLabel = "Manager",
  onCheckedChange,
  onRoleChange,
}: MemberSelectRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900">
      <label className="flex flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="size-4"
        />
        <span>
          {name ?? email}
          {name && <span className="block text-xs text-slate-900/70">{email}</span>}
        </span>
      </label>
      <label className="sr-only" htmlFor={`role-${id}`}>
        Role
      </label>
      <select
        id={`role-${id}`}
        value={role}
        disabled={!checked}
        onChange={(event) => onRoleChange(event.target.value as "member" | "manager")}
        className="rounded-md border border-input-border px-2 py-1.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="member">Member</option>
        <option value="manager">{managerLabel}</option>
      </select>
    </li>
  );
}
