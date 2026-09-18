export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function parseApiErrorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: string[] | string;
  } | null;
  const message = Array.isArray(data?.message)
    ? data.message[0]
    : data?.message;
  return message ?? GENERIC_ERROR_MESSAGE;
}
