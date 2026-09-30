import clsx from "clsx";
import { Spinner } from "./Spinner";

type SettingsSaveBarProps = {
  isDirty: boolean;
  isPending: boolean;
  onDiscard: () => void;
};

/** Sticky footer for OrganisationSettingsForm — its Save button submits the surrounding `<form>` natively. */
export function SettingsSaveBar({
  isDirty,
  isPending,
  onDiscard,
}: SettingsSaveBarProps) {
  const statusText = isPending
    ? "Saving…"
    : isDirty
      ? "Unsaved changes"
      : "All changes saved";

  return (
    <div className="bottom-0 flex items-center justify-between gap-4 rounded-lg bg-primary-dark px-5 py-4 text-white">
      <span className="flex items-center gap-2 text-sm">
        {isPending ? (
          <Spinner className="text-white" />
        ) : (
          <span
            className={clsx(
              "h-2 w-2 rounded-full",
              isDirty ? "bg-cream" : "bg-success",
            )}
          />
        )}
        {statusText}
      </span>

      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDiscard}
          disabled={!isDirty || isPending}
          className="cursor-pointer rounded-md border border-white/30 px-4 h-11 text-sm transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Discard
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="cursor-pointer rounded-md bg-primary px-4 h-11 text-sm transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          Save changes
        </button>
      </span>
    </div>
  );
}
