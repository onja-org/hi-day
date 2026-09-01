import { CircleNotch } from "@phosphor-icons/react";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className = "" }: SpinnerProps) {
  return (
    <CircleNotch
      size={18}
      className={`animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}
