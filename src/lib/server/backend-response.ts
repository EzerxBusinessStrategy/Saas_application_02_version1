export const backendStartingMessage =
  "The service is starting. Wait about 30 seconds and sign in again.";

export function isBackendStartingResponse(status: number, bodyText: string): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  const text = bodyText.toLowerCase();
  return (
    text.includes("service waking up") ||
    text.includes("application loading") ||
    text.includes("incoming http request detected") ||
    (text.includes("<html") && text.includes("render"))
  );
}

export function parseBackendJson(status: number, bodyText: string): unknown {
  if (status === 204) return {};
  if (!bodyText.trim()) return { message: "The service returned an empty response." };
  try {
    return JSON.parse(bodyText);
  } catch {
    if (isBackendStartingResponse(status, bodyText)) {
      return { message: backendStartingMessage };
    }
    return { message: "The service returned an invalid response." };
  }
}
