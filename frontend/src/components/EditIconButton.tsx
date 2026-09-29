import { PencilSimple } from "@phosphor-icons/react";

type EditIconButtonProps = {
  /** Shown as the hover tooltip. */
  label: string;
  /** Read out to screen readers — more specific than `label` when several
   * rows share the same tooltip text, e.g. naming the row's project. */
  accessibleName?: string;
  onClick: () => void;
};

/** A pencil button that stays hidden until its row (an ancestor with the
 * `group` class) is hovered or the button is focused, with a tooltip. */
export function EditIconButton({ label, accessibleName, onClick }: EditIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={accessibleName ?? label}
      className="group/edit relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-primary-dark/60 opacity-0 transition duration-150 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary focus-visible:opacity-100"
    >
      <PencilSimple size={16} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-full z-20 ml-2 hidden -translate-y-1/2 rounded-md bg-primary-dark px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-lg group-hover/edit:block group-focus-visible/edit:block"
      >
        <span className="absolute top-1/2 -left-1 size-2 -translate-y-1/2 rotate-45 bg-primary-dark" />
        {label}
      </span>
    </button>
  );
}
