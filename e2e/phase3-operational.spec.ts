import { expect, test, type Page } from "@playwright/test";

async function expectHealthy(page: Page, path: string) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(path, { waitUntil: "domcontentloaded" });
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

test("manager operational queues remain assigned-scope at desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await expectHealthy(page, "/manager");
  await expect(
    page.getByRole("heading", { name: "Team delivery" }),
  ).toBeVisible();
  await expectHealthy(page, "/manager/reviews");
  await expect(
    page.getByRole("heading", { name: "Review queue" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(
    page.getByText("Decision recorded for this mock session."),
  ).toBeVisible();
});

test("employee task workflow and client portal stay usable on tablet and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await expectHealthy(page, "/employee/tasks");
  await page.getByLabel("Filter by task status").selectOption("in-progress");
  await expect(page.locator("article").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectHealthy(page, "/client");
  await expect(
    page.getByRole("heading", { name: "Service overview" }),
  ).toBeVisible();
  await expectHealthy(page, "/client/invoices");
  await expect(
    page.getByRole("heading", { name: "Invoices", level: 1 }),
  ).toBeVisible();
});

test("employee calendar remains readable on desktop and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await expectHealthy(page, "/employee/calendar");
  await expect(
    page.getByRole("table", { name: /delivery calendar for july 2026/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByText("August 2026")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expectHealthy(page, "/employee/calendar");
  await expect(
    page.getByRole("list", { name: "Upcoming milestones" }),
  ).toBeVisible();
});

test("tenant reports remain readable at the wide tablet breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectHealthy(page, "/admin/reports");
  await expect(
    page.getByRole("heading", { name: "Operational reports" }),
  ).toBeVisible();
});
