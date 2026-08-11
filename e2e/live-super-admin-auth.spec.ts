import { expect, test, type Page } from "@playwright/test";

const superAdminEmail = process.env.LIVE_SUPER_ADMIN_EMAIL;
const superAdminPassword = process.env.LIVE_SUPER_ADMIN_PASSWORD;

function requireLiveCredentials() {
  if (!superAdminEmail || !superAdminPassword) {
    throw new Error(
      "LIVE_SUPER_ADMIN_EMAIL and LIVE_SUPER_ADMIN_PASSWORD are required.",
    );
  }
  return { email: superAdminEmail, password: superAdminPassword };
}

async function reachPasswordStep(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

async function loginSuperAdmin(page: Page) {
  const credentials = requireLiveCredentials();
  await reachPasswordStep(page, credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/super-admin", { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Platform overview" }),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe("live Super Admin authentication and session", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("validates empty, malformed, unknown, and wrong credentials safely", async ({
    page,
  }) => {
    const credentials = requireLiveCredentials();
    await page.goto("/login");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter your work email.", { exact: true })).toBeVisible();

    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid work email.", { exact: true })).toBeVisible();

    const unknownEmail = `unknown-${Date.now()}@example.com`;
    await reachPasswordStep(page, unknownEmail);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword!123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByText("Invalid email or password. Please try again.", { exact: true }),
    ).toBeVisible();

    await reachPasswordStep(page, credentials.email);
    await page.getByLabel("Password", { exact: true }).fill("WrongPassword!123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByText("Invalid email or password. Please try again.", { exact: true }),
    ).toBeVisible();
  });

  test("keeps a valid session across refresh and exposes the Super Admin workspace", async ({
    page,
  }) => {
    await loginSuperAdmin(page);

    await expect(page.getByText("Total tenants", { exact: true })).toBeVisible();
    await expect(page.getByText("Active tenants", { exact: true })).toBeVisible();
    await expect(page.getByText("Recent Activity", { exact: true })).toBeVisible();

    const notifications = page.getByRole("button", { name: /Notifications/ });
    await expect(notifications).toBeVisible();
    await notifications.click();
    await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Search workspace navigation" }).click();
    await expect(page.getByRole("heading", { name: "Search platform" }).last()).toBeVisible();
    await page
      .getByPlaceholder("Search tenants, users, email or code")
      .fill("tenant");
    await expect(page.getByText(/Searching|result|No matching/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Tenant list" }).click();
    await page.waitForURL("**/super-admin/tenants");
    await expect(page.getByRole("heading", { name: "Tenant list" })).toBeVisible();
    await expect(page.getByPlaceholder("Search tenant, code, or owner")).toBeVisible();
    await expect(page.getByLabel("Tenant sort order")).toBeVisible();
    await expect(page.getByLabel("Pagination")).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/super-admin\/tenants/);
    await expect(page.getByRole("heading", { name: "Tenant list" })).toBeVisible();
  });

  test("logout and invalid sessions cannot restore protected access", async ({ page }) => {
    await loginSuperAdmin(page);
    await page.getByRole("button", { name: "Open user menu" }).click();
    await page.getByText("Sign out", { exact: true }).click();
    await page.waitForURL("**/login");

    await page.goBack();
    await page.waitForURL("**/login");
    await page.goto("/super-admin/tenants");
    await page.waitForURL("**/login");

    await loginSuperAdmin(page);
    const origin = new URL(page.url()).origin;
    await page.context().addCookies([
      {
        name: "saas-super-admin-access-token",
        value: "invalid-access-token",
        url: origin,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
      {
        name: "saas-super-admin-refresh-token",
        value: "invalid-refresh-token",
        url: origin,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/super-admin");
    await page.waitForURL("**/login", { timeout: 30_000 });

    await loginSuperAdmin(page);
    await expect(page).toHaveURL(/\/super-admin$/);
  });

  test("manager route redirects to the employee workspace route", async ({ request }) => {
    const response = await request.get("/manager", { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toBe("/employee");
  });
});
