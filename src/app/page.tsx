import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoSessionCookie, roleFromSession, workspaceForRole } from "@/lib/demo-auth";
export default async function Home() {
  const role = roleFromSession(
    (await cookies()).get(demoSessionCookie)?.value,
  );
  const workspace = role ? workspaceForRole(role) : null;
  redirect(workspace ? `/${workspace}` : "/login");
}
