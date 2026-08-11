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

  // The backend deliberately returns this same result for every valid email
  // to prevent account enumeration. Keeping that advisory step local avoids
  // blocking the login form while a Render API instance wakes up.
  return NextResponse.json({ method: "password" });
}
