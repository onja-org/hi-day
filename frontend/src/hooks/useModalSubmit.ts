import { useCallback, useState } from "react";

/**
 * Pending and error state for a modal's submit. `submit` runs the action —
 * which resolves with a message to show on failure, or with nothing on
 * success — and reports whether it succeeded, so the caller can close the
 * modal only then.
 */
export function useModalSubmit() {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const submit = useCallback(async (action: () => Promise<string | void> | string | void) => {
    setIsPending(true);
    setErrorMessage(undefined);
    const failure = await action();
    setIsPending(false);
    if (failure) setErrorMessage(failure);
    return !failure;
  }, []);

  const reset = useCallback(() => {
    setIsPending(false);
    setErrorMessage(undefined);
  }, []);

  return { isPending, errorMessage, submit, reset };
}
