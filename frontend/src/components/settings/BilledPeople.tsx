"use client";

import { useBilledSeats } from "@/hooks/useBilledSeats";
import { formatMembershipRole } from "@/lib/formatMembershipRole";
import { ErrorMessage } from "../ErrorMessage";
import { Spinner } from "../Spinner";

type BilledPeopleProps = {
  organisationId: number;
};

/**
 * Who the organisation pays for. The names matter as much as the number:
 * "why am I paying for 14?" is the question an admin actually has, and a
 * bare count cannot answer it.
 */
export function BilledPeople({ organisationId }: BilledPeopleProps) {
  const seatsQuery = useBilledSeats(organisationId);

  return (
    <section className="rounded-brand-sm border-2 border-ink bg-white p-6">
      <h2 className="text-base font-semibold text-primary-dark">
        People you&apos;re billed for
      </h2>

      {seatsQuery.isLoading && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-900">
          <Spinner className="text-primary-dark" />
          Counting…
        </p>
      )}

      {seatsQuery.isError && (
        <div className="mt-3">
          <ErrorMessage
            message={
              seatsQuery.error instanceof Error
                ? seatsQuery.error.message
                : "Could not load who you are billed for."
            }
          />
        </div>
      )}

      {seatsQuery.data && (
        <>
          <p className="mt-1 text-sm text-slate-900/60">
            Everyone who can track time. Deactivated people aren&apos;t
            counted.
          </p>
          <p className="mt-4 font-data text-2xl font-bold text-primary-dark">
            {seatsQuery.data.count}{" "}
            <span className="text-sm font-normal text-slate-900/60">
              {seatsQuery.data.count === 1 ? "person" : "people"}
            </span>
          </p>

          <ul className="mt-4 flex flex-col divide-y divide-input-border border-t border-input-border">
            {seatsQuery.data.people.map((person) => (
              <li
                key={person.membershipId}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="text-sm text-slate-900">
                  {person.name ?? person.email}
                </span>
                <span className="text-sm text-slate-900/60">
                  {formatMembershipRole(person.role)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
