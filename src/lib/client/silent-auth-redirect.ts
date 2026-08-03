"use client";

export async function redirectToLoginOnUnauthorized(response: Response): Promise<void> {
  if (response.status !== 401) return;
  try {
    await fetch("/api/demo-auth/logout", { method: "POST" });
  } finally {
    window.location.replace("/login");
  }
}
