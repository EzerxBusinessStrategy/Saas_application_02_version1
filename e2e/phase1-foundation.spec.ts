import { expect, test, type Page } from "@playwright/test";

async function expectHealthyPage(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test("Phase 1 auth routes work at 1440px without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  const notFound: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${message.text()} (${message.location().url})`);
    }
  });
  page.on("response", (response) => {
    if (response.status() === 404) notFound.push(response.url());
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [path, heading] of [
    ["/login", "Sign in to Acme Ops"],
    ["/forgot-password", "Reset your password"],
    ["/reset-password", "Choose a new password"],
    ["/accept-invitation", "Accept your invitation"],
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expectHealthyPage(page);
  }

  expect(notFound).toEqual([]);
  expect(errors).toEqual([]);
});

test("Phase 1 sidebar grid, collapse, and permission boundary work at desktop widths", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".app-shell__sidebar")).toHaveCSS(
      "width",
      "256px",
    );
    await expect(
      page.locator("header").getByRole("button", {
        name: "Collapse navigation",
      }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Collapse navigation" }).click();
    await expect(page.locator(".app-shell__sidebar")).toHaveCSS(
      "width",
      "76px",
    );
    await expect(page.getByLabel("Dashboard")).toBeVisible();
    await expectHealthyPage(page);
  }

  await page.getByLabel("Dashboard").focus();
  await expect(
    page.locator('[role="tooltip"]').filter({ hasText: "Dashboard" }),
  ).toBeVisible();
  const operations = page.getByRole("button", {
    name: "Operations navigation",
  });
  await operations.click();
  await expect(
    page.getByRole("group", { name: "Operations navigation" }),
  ).toBeVisible();
  await operations.press("Escape");
  await expect(
    page.getByRole("group", { name: "Operations navigation" }),
  ).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedTransitionMs = await page
    .locator(".app-shell")
    .evaluate((node) => {
      const value = getComputedStyle(node).transitionDuration;
      return Number.parseFloat(value) * (value.endsWith("ms") ? 1 : 1000);
    });
  expect(reducedTransitionMs).toBeLessThanOrEqual(1);

  await page.goto("/client/tasks", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("You don't have access to this area"),
  ).toBeVisible();
  await expectHealthyPage(page);
  expect(errors).toEqual([]);
});

test("Phase 1 mobile navigation works at tablet and mobile widths without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("dialog", { name: "Workspace navigation" }),
    ).toBeVisible();
    await expectHealthyPage(page);
    await page.getByRole("button", { name: "Close" }).click();
  }
  expect(errors).toEqual([]);
});

test("Phase 1 tablet auth layout works at 768px", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/reset-password", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
  await expectHealthyPage(page);
  expect(errors).toEqual([]);
});
