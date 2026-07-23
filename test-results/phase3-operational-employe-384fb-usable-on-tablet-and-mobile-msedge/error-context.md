# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase3-operational.spec.ts >> employee task workflow and client portal stay usable on tablet and mobile
- Location: e2e\phase3-operational.spec.ts:39:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Filter by task status')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e3]:
    - generic [ref=e4]:
      - img "Acme Ops" [ref=e5]
      - generic [ref=e6]: Acme Ops
    - generic [ref=e8]:
      - generic [ref=e10]:
        - img [ref=e12]
        - generic [ref=e15]:
          - heading "Sign in to Acme Ops" [level=2] [ref=e16]
          - paragraph [ref=e17]: Use your work account to access your authorised workspace.
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]:
            - text: Work email
            - textbox "Work email" [ref=e21]:
              - /placeholder: name@company.com
          - generic [ref=e22]:
            - generic [ref=e23]: Password
            - generic [ref=e24]:
              - textbox "Password" [ref=e25]
              - button "Show password" [ref=e26]:
                - img [ref=e27]
          - generic [ref=e30]:
            - generic [ref=e31]: Portal access
            - combobox "Portal access" [ref=e32]:
              - option "Super Admin" [selected]
              - option "Tenant Admin"
              - option "Manager"
              - option "Employee"
              - option "Client User"
            - generic [ref=e33]: Select the portal assigned to your account.
          - generic [ref=e34]:
            - generic [ref=e35]:
              - checkbox "Remember me" [ref=e36]
              - text: Remember me
            - link "Forgot password?" [ref=e37] [cursor=pointer]:
              - /url: /forgot-password
          - button "Sign in" [ref=e38]:
            - img [ref=e39]
            - text: Sign in
        - generic [ref=e43]:
          - paragraph [ref=e44]: Protected by enterprise-grade authentication
          - generic [ref=e45]:
            - generic [ref=e46]: MFA supported
            - generic [ref=e47]: •
            - generic [ref=e48]: Encrypted connection
            - generic [ref=e49]: •
            - generic [ref=e50]: Role-based access
    - generic [ref=e51]:
      - generic [ref=e52]: Privacy
      - generic [ref=e53]: Terms
      - generic [ref=e54]: Help
      - generic [ref=e55]: System status
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e61] [cursor=pointer]:
    - img [ref=e62]
  - alert [ref=e65]
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
  28 |   ).toBeVisible();
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
> 44 |   await page.getByLabel("Filter by task status").selectOption("in-progress");
     |                                                  ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
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