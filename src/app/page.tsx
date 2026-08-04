import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoSessionCookie, roleFromSession, workspaceForRole } from "@/lib/demo-auth";
import { authenticatedWorkspaceCookie, superAdminAccessTokenCookie, superAdminRefreshTokenCookie } from "@/lib/auth-cookies";
export default async function Home() {
  const cookieStore = await cookies();
  if (cookieStore.get(authenticatedWorkspaceCookie)?.value === "admin" && cookieStore.get(superAdminAccessTokenCookie)?.value) {
    redirect("/admin");
  }
  if (cookieStore.get(superAdminAccessTokenCookie)?.value) {
    redirect("/super-admin");
  }
  if (cookieStore.get(superAdminRefreshTokenCookie)?.value) {
    redirect("/api/demo-auth/refresh?next=/super-admin");
  }
  const role = roleFromSession(cookieStore.get(demoSessionCookie)?.value);
  const workspace = role ? workspaceForRole(role) : null;
  redirect(workspace ? `/${workspace}` : "/login");
}
