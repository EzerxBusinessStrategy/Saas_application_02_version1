import { expect, test } from "@playwright/test";
test("tenant dashboard shows only its own fixture scope", async ({ page }) => {
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Operations overview" }),
  ).toBeVisible();
  await expect(page.getByText("Tenant B confidential record")).toHaveCount(0);
});
