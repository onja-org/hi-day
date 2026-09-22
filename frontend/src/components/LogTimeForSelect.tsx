type LogTimeForSelectProps = {
  members: { membershipId: string; name: string | null; email: string }[];
};

export function LogTimeForSelect({ members }: LogTimeForSelectProps) {
  return (
    <label className="flex flex-col gap-1.5">
      Log time for
      <select
        name="membershipId"
        defaultValue=""
        className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <option value="">Me</option>
        {members.map((member) => (
          <option key={member.membershipId} value={member.membershipId}>
            {member.name ?? member.email}
          </option>
        ))}
      </select>
    </label>
  );
}
