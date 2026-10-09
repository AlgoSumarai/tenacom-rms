export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Tenacom-Request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new ApiError(
      problem?.title || "Unable to connect. Please try again.",
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export function date(value?: string | null) {
  return value?.slice(0, 10) ?? "";
}
export function hours(minutes: number) {
  return (minutes / 60).toLocaleString("en-ZA", { maximumFractionDigits: 2 });
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
