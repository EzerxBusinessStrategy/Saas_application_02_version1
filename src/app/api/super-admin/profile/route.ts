import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { superAdminAccessTokenCookie } from "@/lib/auth-cookies";
import {
  updateVerifiedSuperAdminProfile,
  userFromSuperAdminMe,
} from "@/lib/server/super-admin-auth";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
});

export async function PATCH(request: Request) {
  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Enter a display name." }, { status: 400 });
  }

  const accessToken = (await cookies()).get(superAdminAccessTokenCookie)?.value;
  if (!accessToken) {
    return NextResponse.json({ message: "Sign in again to update your profile." }, { status: 401 });
  }

  const me = await updateVerifiedSuperAdminProfile({
    accessToken,
    displayName: parsed.data.displayName,
  });
  if (!me) {
    return NextResponse.json({ message: "Profile could not be updated." }, { status: 403 });
  }

  return NextResponse.json({ user: userFromSuperAdminMe(me) });
}
