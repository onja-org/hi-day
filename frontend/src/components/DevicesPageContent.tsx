import { DevicesTable } from "./DevicesTable";
import { RequireRole } from "./RequireRole";

type DevicesPageContentProps = {
  organisationId: string;
};

export function DevicesPageContent({ organisationId }: DevicesPageContentProps) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary-dark">Devices</h1>

      <RequireRole role={["admin", "manager"]}>
        <DevicesTable organisationId={organisationId} />
      </RequireRole>
    </div>
  );
}
