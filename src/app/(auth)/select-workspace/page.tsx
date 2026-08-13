import { redirect } from "next/navigation";

/** @deprecated The portal login URL now selects the workspace. */
export default function SelectWorkspacePage() {
  redirect("/login");
}
