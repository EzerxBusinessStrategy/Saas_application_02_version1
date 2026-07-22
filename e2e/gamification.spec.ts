import { expect, test } from "@playwright/test";

test("professional progress workflows are usable across employee, manager, tenant, and client roles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/employee/work-logs", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: "Weekly work-log completion" }),
  ).toBeVisible();
  await expect(page.getByText(/scheduled days completed/i)).toBeVisible();

  await page.goto("/employee/achievements", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Achievements" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View details" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.goto("/manager/recognition", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Recognise work" }).click();
  await page
    .getByLabel("Reason")
    .fill("Clear evidence links improved the GST filing handoff.");
  await page.getByRole("button", { name: "Record recognition" }).click();
  await expect(page.getByText(/recognition recorded/i)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/client/onboarding", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Onboarding", exact: true }),
  ).toBeVisible();
  await page.goto("/client/deliverables", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Approve deliverable" }).click();
  await expect(page.getByText(/deliverable decision recorded/i)).toBeVisible();

  await page.goto("/admin/gamification", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Gamification settings" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
