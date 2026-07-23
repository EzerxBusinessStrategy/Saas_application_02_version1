# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase3-operational.spec.ts >> manager operational queues remain assigned-scope at desktop
- Location: e2e\phase3-operational.spec.ts:21:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Team delivery' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Team delivery' })

```

```yaml
- complementary:
  - text: Acme Ops
  - paragraph: Operations workspace
  - heading "Secure operations for modern enterprises" [level=1]
  - paragraph: Manage teams, services, compliance workflows and support operations through one secure workspace.
  - list:
    - listitem: Centralised administration
    - listitem: Secure role-based access
    - listitem: Built for multi-team operations
  - text: SSO Ready MFA Supported Role-Based Access
- main:
  - heading "Sign in to Acme Ops" [level=2]
  - paragraph: Use your work account to access your authorised workspace.
  - text: Work email
  - textbox "Work email":
    - /placeholder: name@company.com
  - text: Password
  - textbox "Password"
  - button "Show password":
    - img
  - text: Portal access
  - combobox "Portal access":
    - option "Super Admin" [selected]
    - option "Tenant Admin"
    - option "Manager"
    - option "Employee"
    - option "Client User"
  - text: Select the portal assigned to your account.
  - checkbox "Remember me"
  - text: Remember me
  - link "Forgot password?":
    - /url: /forgot-password
  - button "Sign in"
  - paragraph: Protected by enterprise-grade authentication
  - text: MFA supported Encrypted connection Role-based access Privacy Terms Help System status
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | async function expectHealthy(page: Page, path: string) {
  4  |   const errors: string[] = [];
  5  |   page.on("console", (message) => {
  6  |     if (message.type() === "error") errors.push(message.text());
  7  |   });
  8  |   await page.goto(path, { waitUntil: "domcontentloaded" });
  9  |   await page.waitForLoadState("networkidle");
  10 |   await expect(page.locator("main")).toBeVisible();
  11 |   await expect
  12 |     .poll(() =>
  13 |       page.evaluate(
  14 |         () => document.documentElement.scrollWidth <= window.innerWidth,
  15 |       ),
  16 |     )
  17 |     .toBe(true);
  18 |   expect(errors).toEqual([]);
  19 | }
  20 | 
  21 | test("manager operational queues remain assigned-scope at desktop", async ({
  22 |   page,
  23 | }) => {
  24 |   await page.setViewportSize({ width: 1440, height: 960 });
  25 |   await expectHealthy(page, "/manager");
  26 |   await expect(
  27 |     page.getByRole("heading", { name: "Team delivery" }),
> 28 |   ).toBeVisible();
     |     ^ Error: expect(locator).toBeVisible() failed
  29 |   await expectHealthy(page, "/manager/reviews");
  30 |   await expect(
  31 |     page.getByRole("heading", { name: "Review queue" }),
  32 |   ).toBeVisible();
  33 |   await page.getByRole("button", { name: "Approve" }).first().click();
  34 |   await expect(
  35 |     page.getByText("Decision recorded for this mock session."),
  36 |   ).toBeVisible();
  37 | });
  38 | 
  39 | test("employee task workflow and client portal stay usable on tablet and mobile", async ({
  40 |   page,
  41 | }) => {
  42 |   await page.setViewportSize({ width: 768, height: 900 });
  43 |   await expectHealthy(page, "/employee/tasks");
  44 |   await page.getByLabel("Filter by task status").selectOption("in-progress");
  45 |   await expect(page.locator("article").first()).toBeVisible();
  46 |   await page.setViewportSize({ width: 390, height: 844 });
  47 |   await expectHealthy(page, "/client");
  48 |   await expect(
  49 |     page.getByRole("heading", { name: "Service overview" }),
  50 |   ).toBeVisible();
  51 |   await expectHealthy(page, "/client/invoices");
  52 |   await expect(
  53 |     page.getByRole("heading", { name: "Invoices", level: 1 }),
  54 |   ).toBeVisible();
  55 | });
  56 | 
  57 | test("employee calendar remains readable on desktop and mobile", async ({
  58 |   page,
  59 | }) => {
  60 |   await page.setViewportSize({ width: 1024, height: 900 });
  61 |   await expectHealthy(page, "/employee/calendar");
  62 |   await expect(
  63 |     page.getByRole("table", { name: /delivery calendar for july 2026/i }),
  64 |   ).toBeVisible();
  65 |   await page.getByRole("button", { name: "Next month" }).click();
  66 |   await expect(page.getByText("August 2026")).toBeVisible();
  67 | 
  68 |   await page.setViewportSize({ width: 390, height: 844 });
  69 |   await expectHealthy(page, "/employee/calendar");
  70 |   await expect(
  71 |     page.getByRole("list", { name: "Upcoming milestones" }),
  72 |   ).toBeVisible();
  73 | });
  74 | 
  75 | test("tenant reports remain readable at the wide tablet breakpoint", async ({
  76 |   page,
  77 | }) => {
  78 |   await page.setViewportSize({ width: 1280, height: 900 });
  79 |   await expectHealthy(page, "/admin/reports");
  80 |   await expect(
  81 |     page.getByRole("heading", { name: "Operational reports" }),
  82 |   ).toBeVisible();
  83 | });
  84 | 
```