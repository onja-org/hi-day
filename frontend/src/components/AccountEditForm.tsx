"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash } from "@phosphor-icons/react";
import { MY_PROFILE_QUERY_KEY, useMyProfile } from "@/hooks/useMyProfile";
import { updateMyProfile } from "@/lib/updateMyProfile";
import type { MyProfile } from "@/types/profile";
import { ErrorMessage } from "./ErrorMessage";
import { Spinner } from "./Spinner";

const MAX_AVATAR_FILE_BYTES = 1.5 * 1024 * 1024;
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

function displayName(profile: MyProfile): string {
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
}

function initials(profile: MyProfile): string {
  const first = profile.firstName?.charAt(0) ?? "";
  const last = profile.lastName?.charAt(0) ?? "";
  return (first + last || profile.email.charAt(0)).toUpperCase();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AvatarEditor({ profile }: { profile: MyProfile }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const avatarMutation = useMutation({
    mutationFn: updateMyProfile,
    onMutate: () => setAvatarError(null),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(MY_PROFILE_QUERY_KEY, result.profile);
      }
    },
  });

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setAvatarError("Please choose an image smaller than 1.5MB.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      avatarMutation.mutate({ avatarUrl: dataUrl });
    } catch {
      setAvatarError(GENERIC_ERROR_MESSAGE);
    }
  }

  function handleRemove() {
    avatarMutation.mutate({ avatarUrl: "" });
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-semibold text-primary">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials(profile)
        )}
        {avatarMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Spinner className="text-white" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarMutation.isPending}
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-sm text-primary transition-all duration-150 hover:bg-primary/10 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera size={16} aria-hidden="true" />
            Change photo
          </button>
          {profile.avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={avatarMutation.isPending}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input-border px-3 py-1.5 text-sm text-slate-900 transition-colors duration-150 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash size={16} aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="text-xs text-slate-900/60">JPG or PNG, up to 1.5MB.</span>
        {avatarError && <ErrorMessage message={avatarError} />}
      </div>
    </div>
  );
}

export function AccountEditForm() {
  const queryClient = useQueryClient();
  const profileQuery = useMyProfile();

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(MY_PROFILE_QUERY_KEY, result.profile);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("firstName") ?? "");
    const lastName = String(formData.get("lastName") ?? "");
    updateMutation.mutate({ firstName, lastName });
  }

  if (profileQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 text-slate-900">
        <Spinner className="text-primary-dark" />
        Loading your account…
      </p>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <ErrorMessage
        message={
          profileQuery.error instanceof Error
            ? profileQuery.error.message
            : "Could not load your account."
        }
      />
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="flex w-full max-w-lg flex-col gap-8 rounded-xl border border-input-border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-primary-dark">
          {displayName(profile)}
        </h2>
        <p className="text-sm text-slate-900/70">{profile.email}</p>
      </div>

      <AvatarEditor profile={profile} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-slate-900">
            First name
            <input
              name="firstName"
              type="text"
              defaultValue={profile.firstName ?? ""}
              required
              className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-slate-900">
            Last name
            <input
              name="lastName"
              type="text"
              defaultValue={profile.lastName ?? ""}
              required
              className="rounded-md border border-input-border bg-white px-3 py-2 text-slate-900 transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-md bg-primary px-4 py-2 text-white transition-all duration-150 hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-primary/50"
        >
          {updateMutation.isPending && <Spinner />}
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
