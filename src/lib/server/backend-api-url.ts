const localBackendApiBaseUrl = "http://localhost:4000/api/v1";
const productionBackendApiBaseUrl =
  "https://saas-application-02-version1-api.onrender.com/api/v1";

export function backendApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const production = process.env.NODE_ENV === "production";

  if (!configured || configured === "https://api.example.com") {
    return (production ? productionBackendApiBaseUrl : localBackendApiBaseUrl).replace(/\/+$/, "");
  }

  if (production && isLocalUrl(configured)) {
    return productionBackendApiBaseUrl;
  }

  return configured.replace(/\/+$/, "");
}

function isLocalUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  } catch {
    return false;
  }
}
