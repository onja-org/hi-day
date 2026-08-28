import { WarningCircle } from "@phosphor-icons/react";

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-md border border-error p-3 text-error"
    >
      <WarningCircle size={20} aria-hidden="true" />
      {message}
    </p>
  );
}
