import { NextResponse } from "next/server";
import { z } from "zod";

const identifySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
});

/**
 * POST /api/auth/identify
 *
 * Accepts a work email and determines the correct authentication method.
 * Returns either a password prompt (with optional display name) or an
 * SSO redirect target.
 *
 * Currently all emails resolve to the "password" method.
 * SSO provider mapping will be configured in a future iteration.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = identifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Enter a valid work email." },
      { status: 400 },
    );
  }

  const email = parsed.data.email;

  // --- Future SSO lookup ---
  // Check if the email domain has a configured SSO provider.
  // const domain = email.split("@")[1];
  // const ssoConfig = await lookupSsoProvider(domain);
  // if (ssoConfig) {
  //   return NextResponse.json({
  //     method: "sso" as const,
  //     provider: ssoConfig.provider,
  //     redirectUrl: ssoConfig.redirectUrl,
  //   });
  // }

  // Try to look up display name from Supabase Auth user metadata
  let displayName: string | undefined;
  try {
    const supabaseUrl = process.env.BACKEND_SUPABASE_URL?.replace(/\/+$/, "");
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const usersResponse = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
        {
          headers: {
            apikey: supabaseServiceKey,
            authorization: `Bearer ${supabaseServiceKey}`,
          },
          cache: "no-store",
        },
      );
      if (usersResponse.ok) {
        const data = (await usersResponse.json()) as {
          users?: { email?: string; user_metadata?: { display_name?: string; full_name?: string } }[];
        };
        const matchedUser = data.users?.find(
          (u) => u.email?.toLowerCase() === email,
        );
        displayName =
          matchedUser?.user_metadata?.display_name ??
          matchedUser?.user_metadata?.full_name ??
          undefined;
      }
    }
  } catch {
    // Gracefully fall back — display name is a UX enhancement, not required
  }

  return NextResponse.json({
    method: "password" as const,
    displayName: displayName ?? undefined,
  });
}
