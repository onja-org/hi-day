import { API_URL } from "./apiUrl";
import type { GetMyProjectsResult } from "@/types/project";

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function getMyProjects(
  organisationId: string,
): Promise<GetMyProjectsResult> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/organisations/${organisationId}/projects/my-projects`,
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
