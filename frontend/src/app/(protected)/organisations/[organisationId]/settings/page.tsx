import { redirect } from "next/navigation";
import { defaultSettingsHref } from "@/lib/settingsNavigation";

type SettingsPageProps = {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ confirmDeletion?: string }>;
};

/**
 * Settings has sections of its own now, so the bare path forwards to the
 * first. `confirmDeletion` is carried across rather than dropped: the
 * deletion-confirmation email links here, and the token is the whole point
 * of that link.
 */
export default async function SettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { organisationId } = await params;
  const { confirmDeletion } = await searchParams;
  const href = defaultSettingsHref(organisationId);

  redirect(
    confirmDeletion
      ? `${href}?confirmDeletion=${encodeURIComponent(confirmDeletion)}`
      : href,
  );
}
