"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { Toaster, toast } from "sonner";

const GENERIC_MUTATION_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

function isApiResult(data: unknown): data is { ok: boolean; message: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    typeof (data as { ok: unknown }).ok === "boolean" &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  );
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onSuccess: (data) => {
            if (!isApiResult(data)) {
              if (process.env.NODE_ENV !== "production") {
                console.warn(
                  "Mutation resolved without an ApiResult<T> `message` field, so no toast was shown. Every mutation should return { ok, message }.",
                  data,
                );
              }
              return;
            }
            if (data.ok) {
              toast.success(data.message);
            } else {
              toast.error(data.message);
            }
          },
          onError: () => {
            toast.error(GENERIC_MUTATION_ERROR_MESSAGE);
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        icons={{
          success: <CheckCircle size={20} aria-hidden="true" />,
          error: <WarningCircle size={20} aria-hidden="true" />,
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "flex items-center gap-2 rounded-md border bg-white p-3 shadow-sm w-full",
            success: "border-success text-success",
            error: "border-error text-error",
          },
        }}
      />
    </QueryClientProvider>
  );
}
