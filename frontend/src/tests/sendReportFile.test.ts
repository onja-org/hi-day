import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendReport } from "@/lib/sendReport";
import { sendReportFile } from "@/lib/sendReportFile";
import type { SendReportInput } from "@/types/sendReport";

vi.mock("@/lib/sendReport", () => ({ sendReport: vi.fn() }));

const input: SendReportInput = { emails: ["a@b.co"], subject: "Weekly", message: "Hi", fileType: "csv" };

function run(overrides: Partial<Parameters<typeof sendReportFile>[0]> = {}) {
  return sendReportFile({
    organisationId: "org-1",
    input,
    filenameBase: "report-2026",
    isEmpty: false,
    buildContent: vi.fn(async () => "BASE64"),
    ...overrides,
  });
}

beforeEach(() => {
  vi.mocked(sendReport).mockReset();
  vi.mocked(sendReport).mockResolvedValue({ ok: true, message: "Sent" });
});

describe("sendReportFile", () => {
  it("refuses an empty report without building or sending", async () => {
    const buildContent = vi.fn();
    expect(await run({ isEmpty: true, buildContent })).toBe("There's nothing to send for this date range.");
    expect(buildContent).not.toHaveBeenCalled();
    expect(sendReport).not.toHaveBeenCalled();
  });

  it("builds the file with the chosen type and subject, then sends it named after the type", async () => {
    const buildContent = vi.fn(async () => "BASE64");
    expect(await run({ buildContent })).toBeUndefined();
    expect(buildContent).toHaveBeenCalledWith("csv", "Weekly");
    expect(sendReport).toHaveBeenCalledWith("org-1", {
      ...input,
      filename: "report-2026.csv",
      contentBase64: "BASE64",
    });
  });

  it("returns the send failure's message", async () => {
    vi.mocked(sendReport).mockResolvedValue({ ok: false, message: "Mail is down" });
    expect(await run()).toBe("Mail is down");
  });

  it("returns a build failure message when the file can't be built", async () => {
    const buildContent = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(await run({ buildContent })).toBe("The report file could not be built. Please try again.");
    expect(sendReport).not.toHaveBeenCalled();
  });
});
