"use client";

import { CheckboxField } from "@/components/ui/form/CheckboxField";
import { SelectField } from "@/components/ui/form/SelectField";

type MemberSelectRowProps<TRole extends string> = {
  name: string | null;
  email: string;
  checked: boolean;
  role: TRole;
  /** The roles this row can pick from — Projects and Teams offer different ones. */
  roleOptions: { value: TRole; label: string }[];
  onCheckedChange: (checked: boolean) => void;
  onRoleChange: (role: TRole) => void;
};

/** One checkable candidate row, shared by the Projects and Teams "add
 * members" checklists — a checkbox plus that row's own role choice, so a
 * single batch submit can add people with different roles together. */
export function MemberSelectRow<TRole extends string>({
  name,
  email,
  checked,
  role,
  roleOptions,
  onCheckedChange,
  onRoleChange,
}: MemberSelectRowProps<TRole>) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-input-border px-3 py-2 text-slate-900">
      <CheckboxField
        className="flex-1"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        label={
          <span>
            {name ?? email}
            {name && (
              <span className="block text-xs text-slate-900/70">{email}</span>
            )}
          </span>
        }
      />
      <SelectField
        label="Role"
        className="shrink-0 items-end gap-1"
        compact
        value={role}
        disabled={!checked}
        onChange={(event) => onRoleChange(event.target.value as TRole)}
      >
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
    </li>
  );
}
