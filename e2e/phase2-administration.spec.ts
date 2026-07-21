import { expect, test, type Page } from "@playwright/test";

async function expectHealthyPage(page: Page, path: string) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
}

test("Super Admin tenant lifecycle and visible support access work at desktop width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await expectHealthyPage(page, "/super-admin/tenants");
  await expect(
    page.getByRole("heading", { name: "Tenant management" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create tenant" }),
  ).toHaveAttribute("href", "/super-admin/tenants/new");
  await page.goto("/super-admin/tenants/new");
  await expect(
    page.getByRole("heading", { name: "Create tenant" }),
  ).toBeVisible();
  await expectHealthyPage(page, "/super-admin/support-access");
  await page.getByLabel("Tenant", { exact: true }).selectOption("tn-001");
  await page
    .locator("#support-reason")
    .fill("Investigate the tenant export timeout for an administrator.");
  await page
    .getByRole("button", { name: "Start visible support session" })
    .click();
  await expect(
    page.getByText("Support mode is visible and time-limited"),
  ).toBeVisible();
});

test("Tenant Admin client directory and detail remain usable at tablet width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await expectHealthyPage(page, "/admin/clients");
  await page.getByLabel("Filter delivery health").selectOption("watch");
  await expect(page).toHaveURL(/health=watch/);
  await page.goto("/admin/clients/cl-101");
  await expect(page.getByRole("tab", { name: "Contacts" })).toBeVisible();
  await page.getByRole("tab", { name: "Contacts" }).click();
  await expect(page.getByRole("button", { name: "Add contact" })).toBeVisible();

  await expectHealthyPage(page, "/admin/work-groups");
  await page.getByRole("button", { name: "Create work group" }).click();
  const workGroupDialog = page.getByRole("dialog");
  await workGroupDialog
    .getByLabel("Work-group name")
    .fill("Quarterly tax review");
  await workGroupDialog
    .getByLabel("Service engagement")
    .fill("Quarterly compliance");
  await workGroupDialog
    .getByRole("button", { name: "Create work group" })
    .click();
  await expect(page.getByText("Quarterly tax review").first()).toBeVisible();
});

test("Tenant creation validation and workforce mobile cards work at tablet and mobile widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await expectHealthyPage(page, "/super-admin/tenants/new");
  await page.getByRole("button", { name: "Prepare tenant request" }).click();
  await expect(page.getByText("Enter the organisation name.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/employees");
  await expect(page.locator("article").first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
