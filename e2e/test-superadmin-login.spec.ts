import { test, expect } from "@playwright/test";

test("Super Admin two-step login flow with superadmin@abc.com", async ({ page }) => {
  console.log("=== STARTING SUPER ADMIN LOGIN PLAYWRIGHT TEST ===");

  page.on("console", (msg) => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  page.on("pageerror", (err) => {
    console.log(`[Browser Uncaught Exception]:`, err.message);
  });

  // 1. Navigate to login
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // 2. Fill email step
  console.log("Step 1: Filling email superadmin@abc.com...");
  await page.fill('input[type="email"]', "superadmin@abc.com");
  await page.click('button:has-text("Continue")');

  // 3. Wait for password input step
  console.log("Step 2: Waiting for password input...");
  const passwordInput = page.locator('#auth-password');
  await passwordInput.waitFor({ state: "visible", timeout: 10000 });

  // 4. Fill password step
  console.log("Step 2: Filling password Super@1234...");
  await passwordInput.focus();
  await passwordInput.fill("Super@1234");
  
  // Click Sign in button explicitly
  console.log("Step 2: Clicking 'Sign in' button...");
  const signInButton = page.locator('button:has-text("Sign in")');
  await signInButton.click();

  // 5. Wait for navigation to /super-admin
  console.log("Waiting for URL navigation to /super-admin...");
  await page.waitForURL("**/super-admin**", { timeout: 20000 });

  console.log("SUCCESS! Current Page URL:", page.url());
  await page.screenshot({ path: ".tmp-superadmin-login-success.png", fullPage: true });

  expect(page.url()).toContain("/super-admin");
});
