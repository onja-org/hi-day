import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

type ActivityQueryStatusProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  loadingLabel: string;
  errorFallback: string;
};

/** The loading-spinner / error-message block every Activity tab renders
 * while its query is in flight or has failed — each tab still owns its own
 * empty-state message and successful-data rendering, since those vary too
 * much per tab to share. */
export function ActivityQueryStatus({
  isLoading,
  isError,
  error,
  loadingLabel,
  errorFallback,
}: ActivityQueryStatusProps) {
  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        {loadingLabel}
      </p>
    );
  }

  if (isError) {
    return <ErrorMessage message={error instanceof Error ? error.message : errorFallback} />;
  }

  return null;
}
