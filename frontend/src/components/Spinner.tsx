import { CircleNotch } from "@phosphor-icons/react";
import clsx from "clsx";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return (
    <CircleNotch
      size={18}
      className={clsx("animate-spin", className)}
      aria-hidden="true"
    />
  );
}
