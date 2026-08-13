import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clientSessionCookie, employeeSessionCookie, superAdminSessionCookie, tenantSessionCookie } from "@/lib/auth-cookies";
export default async function Home() {
  const cookieStore = await cookies();
  if (cookieStore.get(superAdminSessionCookie)?.value) redirect("/super-admin");
  if (cookieStore.get(tenantSessionCookie)?.value) redirect("/admin");
  if (cookieStore.get(employeeSessionCookie)?.value) redirect("/employee");
  if (cookieStore.get(clientSessionCookie)?.value) redirect("/client");
  redirect("/login");
}
