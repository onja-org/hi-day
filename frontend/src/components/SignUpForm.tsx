"use client";

import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { createAccount } from "@/lib/createAccount";
import { parseSignUpFormData } from "@/lib/parseSignUpFormData";
import { ErrorMessage } from "./ErrorMessage";
import { SignUpSuccess } from "./SignUpSuccess";
import { Spinner } from "./Spinner";

const INPUT_CLASSES =
  "rounded-md border border-primary-dark/20 bg-white px-3 py-2 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function SignUpForm() {
  const mutation = useMutation({ mutationFn: createAccount });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = parseSignUpFormData(new FormData(event.currentTarget));
    mutation.mutate(input);
  }

  if (mutation.data?.ok && mutation.variables) {
    return <SignUpSuccess email={mutation.variables.email} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-4xl mx-auto flex-col gap-6"
    >
      {mutation.data && !mutation.data.ok && (
        <ErrorMessage message={mutation.data.message} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          First name
          <input
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            className={INPUT_CLASSES}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          Last name
          <input
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            className={INPUT_CLASSES}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={INPUT_CLASSES}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Company name
        <input
          name="companyName"
          type="text"
          autoComplete="organization"
          required
          className={INPUT_CLASSES}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Address
        <input
          name="address"
          type="text"
          autoComplete="street-address"
          required
          className={INPUT_CLASSES}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        Website (optional)
        <input
          name="website"
          type="text"
          autoComplete="url"
          placeholder="https://example.com"
          className={INPUT_CLASSES}
        />
      </label>

      <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-900">
        <input
          name="agreeToTerms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-primary-dark/20 text-primary focus:ring-primary/30"
        />
        I agree to the Terms of Service and Privacy Policy
      </label>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/50"
      >
        {mutation.isPending && <Spinner />}
        {mutation.isPending ? "Creating your account…" : "Create account"}
      </button>
    </form>
  );
}
