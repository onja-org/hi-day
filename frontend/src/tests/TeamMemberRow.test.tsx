import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useInvalidateTeams", () => ({
  useInvalidateTeams: () => vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { TeamMemberRow } = await import("@/components/TeamMemberRow");

type Role = "admin" | "manager" | "member";

function renderRow(role: Role, { isOrgAdmin = false, canManage = true } = {}) {
  return render(
    <TeamMemberRow
      organisationId="100000"
      teamId="team-1"
      member={{
        membershipId: "m-1",
        userId: "u-1",
        name: "Ada",
        email: "ada@example.test",
        isManager: false,
        role,
        canViewOwnActivity: null,
      }}
      canManage={canManage}
      isOrgAdmin={isOrgAdmin}
    />,
  );
}

const REASON = "Only admins can modify another admin.";

describe("TeamMemberRow", () => {
  it("leaves a team manager read-only on an admin's row, with the reason", () => {
    renderRow("admin");

    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute("title", REASON);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("shows the buttons rather than hiding them", () => {
    renderRow("admin");

    expect(screen.getByRole("button", { name: "Remove" })).toBeVisible();
    expect(screen.getByRole("checkbox")).toBeVisible();
  });

  it("lets a team manager act on an ordinary member", () => {
    renderRow("member");

    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });

  it("lets an org admin act on another admin", () => {
    renderRow("admin", { isOrgAdmin: true });

    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });
});
