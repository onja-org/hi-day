import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";

type ReportStatusProps = {
  isLoading: boolean;
  error?: Error | null;
  loadingLabel?: string;
};

/** A report's loading line and fetch error, shown in place of its content. */
export function ReportStatus({ isLoading, error, loadingLabel = "Loading report…" }: ReportStatusProps) {
  return (
    <>
      {isLoading && (
        <p className="flex items-center gap-2 text-slate-900">
          <Spinner className="text-primary-dark" />
          {loadingLabel}
        </p>
      )}
      {error && <ErrorMessage message={error.message} />}
    </>
  );
}
