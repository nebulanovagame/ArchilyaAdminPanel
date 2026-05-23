import { expect, test } from "@playwright/test";

test("login page smoke test", async ({ page }) => {
  await page.goto("/giris");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Giriş|Giriş Yap/i);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
