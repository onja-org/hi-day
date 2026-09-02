"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/lib/acceptInvitation";
import { getInvitationPreview } from "@/lib/getInvitationPreview";
import type { AcceptInvitationInput } from "@/types/invitation";
import { ErrorMessage } from "./ErrorMessage";
import { JoinExistingAccountView } from "./JoinExistingAccountView";
import { SetInvitationPasswordForm } from "./SetInvitationPasswordForm";
import { Spinner } from "./Spinner";

const REDIRECT_DELAY_MS = 900;

type AcceptInvitationFormProps = {
  token: string;
};

function invalidLinkMessage(
  status: "accepted" | "revoked" | "expired" | "not_found",
): string {
  switch (status) {
    case "accepted":
      return "This invitation has already been accepted. Log in to your account instead.";
    case "revoked":
      return "This invitation has been revoked. Ask an admin to send a new one.";
    case "expired":
      return "This invitation has expired. Ask an admin to resend it.";
    case "not_found":
      return "This link is invalid.";
  }
}

export function AcceptInvitationForm({ token }: AcceptInvitationFormProps) {
  const router = useRouter();

  const previewQuery = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: async () => {
      const result = await getInvitationPreview(token);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.preview;
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (input?: AcceptInvitationInput) =>
      acceptInvitation(token, input),
  });

  useEffect(() => {
    if (!acceptMutation.data?.ok) return;

    const timeout = setTimeout(
      () => router.push("/dashboard"),
      REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [acceptMutation.data, router]);

  if (previewQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Checking your invitation…
      </p>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <ErrorMessage
        message={
          previewQuery.error instanceof Error
            ? previewQuery.error.message
            : "Could not load this invitation."
        }
      />
    );
  }

  const preview = previewQuery.data;

  if (preview.status !== "pending") {
    return <ErrorMessage message={invalidLinkMessage(preview.status)} />;
  }

  if (
    acceptMutation.data &&
    !acceptMutation.data.ok &&
    acceptMutation.data.accountExists
  ) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <ErrorMessage message={acceptMutation.data.message} />
        <Link href="/login" className="text-primary underline">
          Log in, then return to this link to finish joining.
        </Link>
      </div>
    );
  }

  const organisationName = preview.organisationName ?? "your organisation";

  if (preview.accountAlreadyExists) {
    return (
      <JoinExistingAccountView
        email={preview.email ?? ""}
        organisationName={organisationName}
        result={acceptMutation.data}
        isPending={acceptMutation.isPending}
        onJoin={() => acceptMutation.mutate({})}
      />
    );
  }

  return (
    <SetInvitationPasswordForm
      organisationName={organisationName}
      role={preview.role ?? "member"}
      result={acceptMutation.data}
      isPending={acceptMutation.isPending}
      onSubmit={(input) => acceptMutation.mutate(input)}
    />
  );
}
