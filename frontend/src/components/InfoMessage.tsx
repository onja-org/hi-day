import { InfoIcon } from "@phosphor-icons/react";

type InfoMessageProps = {
  message: string;
};

/** A neutral notice, for telling someone how things are rather than that
 * something went wrong — `ErrorMessage`'s red is for the latter. */
export function InfoMessage({ message }: InfoMessageProps) {
  return (
    <p className="animate-fade-in-up flex items-center gap-2 rounded-md border border-input-border bg-cream/40 p-3 text-slate-900">
      <InfoIcon size={20} aria-hidden="true" className="shrink-0 text-primary" />
      {message}
    </p>
  );
}
