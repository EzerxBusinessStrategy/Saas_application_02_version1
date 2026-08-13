"use client";

export async function redirectToLoginOnUnauthorized(response: Response): Promise<void> {
  if (response.status !== 401) return;
  try {
    await fetch(`/api/auth/${portalForPathname(window.location.pathname)}/logout`, {
      method: "POST",
    });
  } finally {
    window.location.replace(loginPathForPathname(window.location.pathname));
  }
}

function portalForPathname(pathname: string): "super-admin" | "tenant" | "employee" | "client" {
  if (pathname.startsWith("/super-admin")) return "super-admin";
  if (pathname.startsWith("/admin")) return "tenant";
  if (pathname.startsWith("/client")) return "client";
  return "employee";
}

function loginPathForPathname(pathname: string): string {
  if (pathname.startsWith("/super-admin")) return "/super-admin/login";
  if (pathname.startsWith("/admin")) return "/admin/login";
  if (pathname.startsWith("/client")) return "/client/login";
  return "/employee/login";
}
