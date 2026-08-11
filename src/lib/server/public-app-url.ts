export function publicRedirectUrl(requestUrl: string, path: string): URL {
  const configured = process.env.BACKEND_PUBLIC_APP_URL?.trim();
  if (!configured) return new URL(path, new URL(requestUrl).origin);

  const origin = new URL(configured);
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("BACKEND_PUBLIC_APP_URL must use http or https.");
  }
  return new URL(path, `${origin.origin}/`);
}
