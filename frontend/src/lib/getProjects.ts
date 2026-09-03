import { API_URL } from "./apiUrl";
import type { GetProjectsResult, ProjectStatus } from "@/types/project";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export type GetProjectsFilter = {
  status?: ProjectStatus | "all";
  client?: string;
};

export async function getProjects(
  organisationId: string,
  filter: GetProjectsFilter = {},
): Promise<GetProjectsResult> {
  const params = new URLSearchParams();
  if (filter.status && filter.status !== "all") {
    params.set("status", filter.status);
  }
  if (filter.client) {
    params.set("client", filter.client);
  }
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects${query ? `?${query}` : ""}`,
      { method: "GET", credentials: "include" },
    );
  } catch {
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  if (response.ok) {
    const projects = await response.json();
    return { ok: true, projects };
  }

  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return { ok: false, message: message ?? GENERIC_ERROR_MESSAGE };
}
