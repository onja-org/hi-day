import { SelectField } from "@/components/ui/form/SelectField";

type LogTimeForSelectProps = {
  members: { membershipId: string; name: string | null; email: string }[];
};

export function LogTimeForSelect({ members }: LogTimeForSelectProps) {
  return (
    <SelectField label="Log time for" name="membershipId" defaultValue="">
      <option value="">Me</option>
      {members.map((member) => (
        <option key={member.membershipId} value={member.membershipId}>
          {member.name ?? member.email}
        </option>
      ))}
    </SelectField>
  );
}
