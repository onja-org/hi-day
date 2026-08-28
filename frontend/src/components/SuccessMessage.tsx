import { CheckCircle } from "@phosphor-icons/react";

type SuccessMessageProps = {
  message: string;
};

export function SuccessMessage({ message }: SuccessMessageProps) {
  return (
    <p className="flex items-center gap-2 rounded-md border border-success p-3 text-success">
      <CheckCircle size={20} aria-hidden="true" />
      {message}
    </p>
  );
}
