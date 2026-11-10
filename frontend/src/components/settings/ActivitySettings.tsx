"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ACTIVE_MEMBERS_QUERY_KEY,
  useActiveMembers,
} from "@/hooks/useActiveMembers";
import {
  CURRENT_ORGANISATION_QUERY_KEY,
  useCurrentOrganisation,
} from "@/hooks/useCurrentOrganisation";
import { resetMembershipActivityTracking } from "@/lib/resetMembershipActivityTracking";
import { resetMembershipAppUrlTracking } from "@/lib/resetMembershipAppUrlTracking";
import { resetMembershipCanViewOwnActivity } from "@/lib/resetMembershipCanViewOwnActivity";
import { updateMembership } from "@/lib/updateMembership";
import { updateOrganisation } from "@/lib/updateOrganisation";
import type {
  ActiveMemberListItem,
  UpdateMembershipInput,
} from "@/types/membership";
import type { AppUrlTracking } from "@/types/organisation";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Spinner } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";
import { OrgDefaultWithOverrides } from "./OrgDefaultWithOverrides";
import { SettingsSubNav } from "./SettingsSubNav";
import type { SettingsSubNavItem } from "./SettingsSubNav";

type SubNavKey = "track-apps-urls" | "record-activity" | "member-visibility";

const SUB_NAV: SettingsSubNavItem<SubNavKey>[] = [
  { key: "track-apps-urls", label: "Track apps & URLs" },
  { key: "record-activity", label: "Record activity" },
  { key: "member-visibility", label: "Member visibility" },
];

const APP_URL_TRACKING_OPTIONS: { key: AppUrlTracking; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "apps", label: "Apps" },
  { key: "apps_urls", label: "Apps & URLs" },
];

/** `OrgDefaultWithOverrides` keys options by string, so the boolean
 * travels as "on"/"off" — and gets the same per-member override table as
 * Track apps & URLs. */
type ActivityTracking = "on" | "off";

const ACTIVITY_TRACKING_OPTIONS: { key: ActivityTracking; label: string }[] = [
  { key: "on", label: "On" },
  { key: "off", label: "Off" },
];

const toActivityTracking = (enabled: boolean): ActivityTracking =>
  enabled ? "on" : "off";

const fromActivityTracking = (
  value: ActivityTracking | null,
): boolean | null => (value === null ? null : value === "on");

export function ActivitySettings() {
  const [active, setActive] = useState<SubNavKey>("track-apps-urls");

  return (
    <div className="grid gap-6 py-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <SettingsSubNav
        label="Activity sub-sections"
        items={SUB_NAV}
        active={active}
        onSelect={setActive}
      />

      <div className="min-w-0">
        {active === "track-apps-urls" && <TrackAppsUrlsPanel />}
        {active === "record-activity" && <RecordActivityPanel />}
        {active === "member-visibility" && <MemberVisibilityPanel />}
      </div>
    </div>
  );
}

function TrackAppsUrlsPanel() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const membersQuery = useActiveMembers(
    organisation ? String(organisation.id) : "",
    { enabled: Boolean(organisation) },
  );
  const queryClient = useQueryClient();
  const [savingMemberIds, setSavingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [memberError, setMemberError] = useState<string | null>(null);

  const orgMutation = useMutation({
    mutationFn: (next: AppUrlTracking) =>
      updateOrganisation(organisation!.id, { appUrlTracking: next }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async ({
      membershipId,
      input,
    }: {
      membershipId: string;
      input: UpdateMembershipInput;
    }) => {
      const result = await updateMembership(
        String(organisation!.id),
        membershipId,
        input,
      );
      return { membershipId, result };
    },
    onMutate: ({ membershipId }) => {
      setMemberError(null);
      setSavingMemberIds((previous) => new Set(previous).add(membershipId));
    },
    onSettled: (_data, _error, { membershipId }) => {
      setSavingMemberIds((previous) => {
        const next = new Set(previous);
        next.delete(membershipId);
        return next;
      });
    },
    onSuccess: ({ membershipId, result }) => {
      if (!result.ok) {
        setMemberError(result.message);
        return;
      }
      queryClient.setQueryData<ActiveMemberListItem[]>(
        ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
        (previous) =>
          previous?.map((member) =>
            member.id === membershipId
              ? { ...member, appUrlTracking: result.member.appUrlTracking }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      resetMembershipAppUrlTracking(String(organisation!.id)),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
      });
    },
  });

  const rows = useMemo(
    () =>
      (membersQuery.data ?? []).map((member) => ({
        membershipId: member.id,
        name: member.name,
        email: member.email,
        override: member.appUrlTracking,
      })),
    [membersQuery.data],
  );

  if (organisationQuery.isLoading || membersQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (!organisation) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load these settings."
        }
      />
    );
  }

  const orgError = orgMutation.data && !orgMutation.data.ok
    ? orgMutation.data.message
    : null;
  const resetError = resetMutation.data && !resetMutation.data.ok
    ? resetMutation.data.message
    : null;

  return (
    <div className="flex flex-col gap-4">
      {(orgError || memberError || resetError) && (
        <ErrorMessage message={orgError ?? memberError ?? resetError ?? ""} />
      )}
      <OrgDefaultWithOverrides<AppUrlTracking>
        title="Track apps & URLs"
        description="Control whether the names of apps used and the URLs visited are tracked when a timer is running."
        options={APP_URL_TRACKING_OPTIONS}
        orgValue={organisation.appUrlTracking}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({
            membershipId,
            input: { appUrlTracking: next },
          })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}

function RecordActivityPanel() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const membersQuery = useActiveMembers(
    organisation ? String(organisation.id) : "",
    { enabled: Boolean(organisation) },
  );
  const queryClient = useQueryClient();
  const [savingMemberIds, setSavingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [memberError, setMemberError] = useState<string | null>(null);

  const orgMutation = useMutation({
    mutationFn: (next: ActivityTracking) =>
      updateOrganisation(organisation!.id, {
        activityTrackingEnabled: next === "on",
      }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  // The pre-existing Window titles toggle: app/URL capture, not activity.
  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      updateOrganisation(organisation!.id, { windowTrackingEnabled: next }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async ({
      membershipId,
      input,
    }: {
      membershipId: string;
      input: UpdateMembershipInput;
    }) => {
      const result = await updateMembership(
        String(organisation!.id),
        membershipId,
        input,
      );
      return { membershipId, result };
    },
    onMutate: ({ membershipId }) => {
      setMemberError(null);
      setSavingMemberIds((previous) => new Set(previous).add(membershipId));
    },
    onSettled: (_data, _error, { membershipId }) => {
      setSavingMemberIds((previous) => {
        const next = new Set(previous);
        next.delete(membershipId);
        return next;
      });
    },
    onSuccess: ({ membershipId, result }) => {
      if (!result.ok) {
        setMemberError(result.message);
        return;
      }
      queryClient.setQueryData<ActiveMemberListItem[]>(
        ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
        (previous) =>
          previous?.map((member) =>
            member.id === membershipId
              ? {
                  ...member,
                  activityTrackingEnabled: result.member.activityTrackingEnabled,
                }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      resetMembershipActivityTracking(String(organisation!.id)),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
      });
    },
  });

  const rows = useMemo(
    () =>
      (membersQuery.data ?? []).map((member) => ({
        membershipId: member.id,
        name: member.name,
        email: member.email,
        override:
          member.activityTrackingEnabled === null
            ? null
            : toActivityTracking(member.activityTrackingEnabled),
      })),
    [membersQuery.data],
  );

  if (organisationQuery.isLoading || membersQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (!organisation) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load these settings."
        }
      />
    );
  }

  const orgError = orgMutation.data && !orgMutation.data.ok
    ? orgMutation.data.message
    : null;
  const resetError = resetMutation.data && !resetMutation.data.ok
    ? resetMutation.data.message
    : null;

  return (
    <div className="flex flex-col gap-10">
      {(orgError || memberError || resetError) && (
        <ErrorMessage message={orgError ?? memberError ?? resetError ?? ""} />
      )}
      <OrgDefaultWithOverrides<ActivityTracking>
        title="Record activity"
        description="Control whether keyboard and mouse activity is measured while a timer is running, giving each tracked period an activity %. Turning it off stops the measurement for that member; activity already recorded stays visible. Idle detection is unaffected."
        options={ACTIVITY_TRACKING_OPTIONS}
        orgValue={toActivityTracking(organisation.activityTrackingEnabled)}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({
            membershipId,
            input: { activityTrackingEnabled: fromActivityTracking(next) },
          })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />

      {/* Only the heading differs from before — "Record activity" is now
          the real setting above. Not gated on it: window titles qualify
          app/URL capture, not activity. */}
      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold tracking-wider text-slate-900/60 uppercase">
            Window titles
          </h3>
          <p className="text-sm text-slate-900">
            What the desktop agent records while a timer is running. Applies to
            everyone in this workspace.
          </p>
        </header>
        <div className="rounded-brand-sm border-2 border-ink bg-white p-5">
          <Toggle
            name="windowTrackingEnabled"
            label="Window titles"
            description="Includes the title of the active window — the document or page name — alongside the app. Which apps are recorded at all is Track apps \u0026 URLs; with this off, the app is still recorded, just without its title."
            checked={organisation.windowTrackingEnabled}
            onCheckedChange={(next) => mutation.mutate(next)}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * "Members can see their own activity" — the org default plus the same
 * per-member override table the other panels use. When off, a member's own
 * Activity page and dashboard activity widgets are hidden entirely, so they
 * cannot tell the data is being collected. Admins and team managers always
 * see their own regardless. Managers can also set this per member from the
 * member edit page, scoped to their own team.
 */
function MemberVisibilityPanel() {
  const organisationQuery = useCurrentOrganisation();
  const organisation = organisationQuery.data;
  const membersQuery = useActiveMembers(
    organisation ? String(organisation.id) : "",
    { enabled: Boolean(organisation) },
  );
  const queryClient = useQueryClient();
  const [savingMemberIds, setSavingMemberIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [memberError, setMemberError] = useState<string | null>(null);

  const orgMutation = useMutation({
    mutationFn: (next: ActivityTracking) =>
      updateOrganisation(organisation!.id, {
        membersCanViewOwnActivity: next === "on",
      }),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.setQueryData(
        CURRENT_ORGANISATION_QUERY_KEY,
        result.organisation,
      );
    },
  });

  const memberMutation = useMutation({
    mutationFn: async ({
      membershipId,
      input,
    }: {
      membershipId: string;
      input: UpdateMembershipInput;
    }) => {
      const result = await updateMembership(
        String(organisation!.id),
        membershipId,
        input,
      );
      return { membershipId, result };
    },
    onMutate: ({ membershipId }) => {
      setMemberError(null);
      setSavingMemberIds((previous) => new Set(previous).add(membershipId));
    },
    onSettled: (_data, _error, { membershipId }) => {
      setSavingMemberIds((previous) => {
        const next = new Set(previous);
        next.delete(membershipId);
        return next;
      });
    },
    onSuccess: ({ membershipId, result }) => {
      if (!result.ok) {
        setMemberError(result.message);
        return;
      }
      queryClient.setQueryData<ActiveMemberListItem[]>(
        ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
        (previous) =>
          previous?.map((member) =>
            member.id === membershipId
              ? {
                  ...member,
                  canViewOwnActivity: result.member.canViewOwnActivity,
                }
              : member,
          ) ?? previous,
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      resetMembershipCanViewOwnActivity(String(organisation!.id)),
    onSuccess: (result) => {
      if (!result.ok) return;
      queryClient.invalidateQueries({
        queryKey: ACTIVE_MEMBERS_QUERY_KEY(String(organisation!.id)),
      });
    },
  });

  const rows = useMemo(
    () =>
      (membersQuery.data ?? []).map((member) => ({
        membershipId: member.id,
        name: member.name,
        email: member.email,
        override:
          member.canViewOwnActivity === null
            ? null
            : toActivityTracking(member.canViewOwnActivity),
      })),
    [membersQuery.data],
  );

  if (organisationQuery.isLoading || membersQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading…
      </p>
    );
  }

  if (!organisation) {
    return (
      <ErrorMessage
        message={
          organisationQuery.error instanceof Error
            ? organisationQuery.error.message
            : "Could not load these settings."
        }
      />
    );
  }

  const orgError = orgMutation.data && !orgMutation.data.ok
    ? orgMutation.data.message
    : null;
  const resetError = resetMutation.data && !resetMutation.data.ok
    ? resetMutation.data.message
    : null;

  return (
    <div className="flex flex-col gap-4">
      {(orgError || memberError || resetError) && (
        <ErrorMessage message={orgError ?? memberError ?? resetError ?? ""} />
      )}
      <OrgDefaultWithOverrides<ActivityTracking>
        title="Members can see their own activity"
        description="Control whether a member can see their own tracked activity — the Activity page (apps, URLs, screenshots) and the activity widgets on their dashboard. Turning it off hides those from that member entirely. Admins and team managers are never affected, and can always see the people they oversee."
        options={ACTIVITY_TRACKING_OPTIONS}
        orgValue={toActivityTracking(organisation.membersCanViewOwnActivity)}
        onOrgChange={(next) => orgMutation.mutate(next)}
        isSavingOrg={orgMutation.isPending}
        rows={rows}
        onMemberChange={(membershipId, next) =>
          memberMutation.mutate({
            membershipId,
            input: { canViewOwnActivity: fromActivityTracking(next) },
          })
        }
        savingMemberIds={savingMemberIds}
        onApplyToAll={() => resetMutation.mutate()}
        isResetting={resetMutation.isPending}
      />
    </div>
  );
}
