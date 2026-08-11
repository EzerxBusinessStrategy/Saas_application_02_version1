import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const superAdminEmail = process.env.LIVE_SUPER_ADMIN_EMAIL;
const superAdminPassword = process.env.LIVE_SUPER_ADMIN_PASSWORD;
const runId = (process.env.LIVE_QA_RUN_ID ?? Date.now().toString(36)).toLowerCase();
const tenantName = `Codex Live QA ${runId}`;
const tenantLegalName = `${tenantName} Private Limited`;
const tenantCode = `QA-${runId.toUpperCase()}`.slice(0, 30).replace(/-$/, "0");
const tenantSlug = `codex-live-qa-${runId}`.slice(0, 63).replace(/-$/, "0");
const tenantAdminEmail = `codex.live.qa.${runId}@example.com`;
const initialTenantPassword = `Qa!${runId}Initial9`;
const replacementTenantPassword = `Qa!${runId}Changed9`;

function requireSuperAdminCredentials() {
  if (!superAdminEmail || !superAdminPassword) {
    throw new Error(
      "LIVE_SUPER_ADMIN_EMAIL and LIVE_SUPER_ADMIN_PASSWORD are required.",
    );
  }
  return { email: superAdminEmail, password: superAdminPassword };
}

async function login(page: Page, email: string, password: string, workspace: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`**/${workspace}`, { timeout: 30_000 });
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByText("Sign out", { exact: true }).click();
  await page.waitForURL("**/login", { timeout: 30_000 });
}

async function loginSuperAdmin(page: Page) {
  const credentials = requireSuperAdminCredentials();
  await login(page, credentials.email, credentials.password, "super-admin");
  await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible({
    timeout: 30_000,
  });
}

async function searchTenant(page: Page) {
  await page.goto("/super-admin/tenants");
  await expect(page.getByRole("heading", { name: "Tenant list" })).toBeVisible({
    timeout: 30_000,
  });
  const search = page.getByPlaceholder("Search tenant, code, or owner");
  await search.fill(tenantName);
  await search.press("Enter");
  await expect(page.getByText(tenantName, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function openTenantAction(page: Page, action: string) {
  await page.getByRole("button", { name: `Actions for ${tenantName}` }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

async function expectLoginRejected(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Invalid email or password|does not have access/i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/login$/);
}

test("live isolated tenant creation and lifecycle", async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required.");

  const superContext = await browser.newContext({ baseURL });
  const tenantContext = await browser.newContext({ baseURL });
  const superPage = await superContext.newPage();
  const tenantPage = await tenantContext.newPage();

  try {
    await loginSuperAdmin(superPage);
    await superPage.goto("/super-admin/tenants/new");
    await expect(superPage.getByRole("heading", { name: "Create tenant" })).toBeVisible();

    await superPage.getByRole("button", { name: "Save and continue" }).first().click();
    await expect(
      superPage.getByText("Enter the company display name.", { exact: true }),
    ).toBeVisible();

    await superPage.getByLabel("Company display name").fill(tenantName);
    await superPage.getByLabel("Legal company name").fill(tenantLegalName);
    await superPage.getByLabel("Tenant code").fill(tenantCode);
    await superPage.getByLabel("URL slug").fill(tenantSlug);
    await superPage.getByLabel("Country").selectOption("IN");
    await expect(superPage.getByLabel("Reporting currency")).toHaveValue("INR");
    await expect(superPage.getByLabel("Accounting timezone")).toHaveValue("Asia/Kolkata");
    await superPage.getByLabel("Industry").fill("Software quality assurance");
    await superPage.getByLabel("Company registration number").fill(`REG-${runId}`);
    await superPage.getByLabel("Tax / GST / VAT number").fill(`GST-${runId}`);
    await superPage.getByRole("button", { name: "Save and continue" }).first().click();

    await expect(superPage.getByRole("heading", { name: "Financial setup" })).toBeVisible();
    await expect(superPage.getByLabel("Financial-year label")).not.toHaveValue("");
    await expect(superPage.getByLabel("Start date")).not.toHaveValue("");
    await expect(superPage.getByLabel("End date")).not.toHaveValue("");
    await superPage.getByRole("button", { name: "Save and continue" }).first().click();

    await expect(superPage.getByRole("heading", { name: "Tenant Administrator" })).toBeVisible();
    await superPage.getByRole("button", { name: "Save and continue" }).first().click();
    await expect(
      superPage.getByText("Enter the Tenant Administrator name.", { exact: true }),
    ).toBeVisible();

    await superPage.getByLabel("Full name").fill("Codex Live QA Administrator");
    await superPage.getByLabel("Work email").fill(requireSuperAdminCredentials().email);
    await expect(superPage.getByText(/Email already exists/i)).toBeVisible({ timeout: 30_000 });
    await superPage.getByLabel("Work email").fill(tenantAdminEmail);
    await superPage.getByLabel("Initial password").fill(initialTenantPassword);
    await superPage.getByLabel("Phone number").fill("+91 9000000000");
    await expect(superPage.getByText(/Email already exists/i)).toBeHidden({ timeout: 30_000 });
    await superPage.getByRole("button", { name: "Save and continue" }).first().click();

    await expect(superPage.getByRole("heading", { name: "Review and create" })).toBeVisible();
    await expect(superPage.getByText(tenantLegalName, { exact: false })).toBeVisible();
    await expect(superPage.getByText(tenantAdminEmail, { exact: false })).toBeVisible();
    await superPage
      .getByText(/I confirm these company, financial-year and Tenant Administrator details are correct/)
      .click();
    await superPage
      .getByRole("button", { name: "Create tenant and administrator account" })
      .first()
      .click();
    await superPage.waitForURL(/\/super-admin\/tenants\/[0-9a-f-]+$/i, {
      timeout: 60_000,
    });
    await expect(superPage.getByRole("heading", { name: tenantName })).toBeVisible();
    await expect(superPage.getByText(tenantAdminEmail, { exact: true })).toBeVisible();

    await logout(superPage);
    await login(tenantPage, tenantAdminEmail, initialTenantPassword, "admin");
    await expect(tenantPage.getByRole("heading", { name: /Tenant overview/i })).toBeVisible({
      timeout: 30_000,
    });
    await tenantPage.reload();
    await expect(tenantPage).toHaveURL(/\/admin$/);
    await logout(tenantPage);
    await tenantPage.goBack();
    await tenantPage.waitForURL("**/login");
    await login(tenantPage, tenantAdminEmail, initialTenantPassword, "admin");

    await loginSuperAdmin(superPage);
    await searchTenant(superPage);
    await superPage.getByLabel("Tenant sort order").selectOption("createdAt");
    await expect(superPage).toHaveURL(/sort=createdAt/);
    await superPage.getByLabel("Filter by tenant status").selectOption("active");
    await expect(superPage).toHaveURL(/status=active/);
    await expect(superPage.getByLabel("Pagination")).toContainText(/record/);
    await superPage.getByLabel("Rows per page").selectOption("5");
    await expect(superPage).toHaveURL(/pageSize=5/);

    await openTenantAction(superPage, "Suspend tenant");
    const suspendDialog = superPage.getByRole("dialog", { name: "Suspend tenant" });
    await suspendDialog.getByLabel("Suspension period").selectOption("24h");
    await suspendDialog.getByRole("button", { name: "Suspend tenant" }).click();
    await expect(superPage.getByText("Suspended", { exact: true })).toBeVisible({ timeout: 30_000 });

    await tenantPage.reload();
    await tenantPage.waitForURL("**/login", { timeout: 30_000 });
    await expectLoginRejected(tenantPage, tenantAdminEmail, initialTenantPassword);

    await superPage.getByLabel("Filter by tenant status").selectOption("suspended");
    await expect(superPage.getByText(tenantName, { exact: true })).toBeVisible({ timeout: 30_000 });
    await openTenantAction(superPage, "Reactivate tenant");
    await superPage
      .getByRole("dialog", { name: "Reactivate tenant" })
      .getByRole("button", { name: "Reactivate tenant" })
      .click();
    await expect(superPage.getByText("Active", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await login(tenantPage, tenantAdminEmail, initialTenantPassword, "admin");
    await logout(tenantPage);

    await superPage.goto("/super-admin/tenant-password");
    await superPage.getByLabel("Search tenant").fill(tenantName);
    await superPage.getByRole("button", { name: "Search", exact: true }).click();
    await superPage
      .getByLabel("Tenant", { exact: true })
      .selectOption({ label: `${tenantName} (${tenantCode})` });
    await superPage.getByLabel("New password").fill(replacementTenantPassword);
    await superPage.getByLabel("Confirm new password").fill(replacementTenantPassword);
    await superPage.getByRole("button", { name: "Update password" }).click();
    await expect(superPage.getByText(`Password updated for ${tenantAdminEmail}.`)).toBeVisible({
      timeout: 30_000,
    });
    await expectLoginRejected(tenantPage, tenantAdminEmail, initialTenantPassword);
    await login(tenantPage, tenantAdminEmail, replacementTenantPassword, "admin");

    await searchTenant(superPage);
    await openTenantAction(superPage, "Revoke tenant");
    await superPage
      .getByRole("dialog", { name: "Caution: revoke tenant access" })
      .getByRole("button", { name: "Continue" })
      .click();
    const revokeDialog = superPage.getByRole("dialog", { name: "Revoke tenant permanently" });
    await revokeDialog
      .getByText("I understand that revocation cannot be undone here.")
      .click();
    await revokeDialog.getByRole("button", { name: "Revoke tenant" }).click();
    await expect(superPage.getByText("Revoked", { exact: true })).toBeVisible({ timeout: 30_000 });

    await tenantPage.reload();
    await tenantPage.waitForURL("**/login", { timeout: 30_000 });
    await expectLoginRejected(tenantPage, tenantAdminEmail, replacementTenantPassword);
  } finally {
    await Promise.all([superContext.close(), tenantContext.close()]);
  }
});
