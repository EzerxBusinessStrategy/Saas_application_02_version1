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
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expectHealthyPage(page);
  }

  expect(notFound).toEqual([]);
  expect(errors).toEqual([]);
});

test("Phase 1 sidebar and permission boundary work at 1024px", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect(page.getByLabel("Dashboard")).toBeVisible();
  await expectHealthyPage(page);

  await page.goto("/client/tasks");
  await expect(
    page.getByText("You don't have access to this area"),
  ).toBeVisible();
  await expectHealthyPage(page);
  expect(errors).toEqual([]);
});

test("Phase 1 mobile navigation works at 390px without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeVisible();
  await expectHealthyPage(page);
  expect(errors).toEqual([]);
});

test("Phase 1 tablet auth layout works at 768px", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Choose a new password" }),
  ).toBeVisible();
  await expectHealthyPage(page);
  expect(errors).toEqual([]);
});
