import { NextResponse } from "next/server";
import { z } from "zod";

const identifySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = identifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid work email." },
      { status: 400 },
    );
  }

  const response = await fetch(`${backendApiBaseUrl()}/auth/identify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: parsed.data.email }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response) {
    return NextResponse.json(
      { message: "Unable to verify this email. Please try again." },
      { status: 503 },
    );
  }

  const data = await response.json().catch(() => null);
  return NextResponse.json(
    data ?? { message: "Unable to verify this email. Please try again." },
    { status: response.status },
  );
}

function backendApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  const fallback = "http://localhost:4000/api/v1";
  return (!configured || configured === "https://api.example.com" ? fallback : configured).replace(/\/+$/, "");
}
