import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should sign in with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in credentials
    await page.getByTestId('email-input').fill('testuser@example.com');
    await page.getByTestId('password-input').fill('TestPass123!');
    await page.getByTestId('sign-in-button').click();

    // Should navigate to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('email-input').fill('wrong@example.com');
    await page.getByTestId('password-input').fill('WrongPass123!');
    await page.getByTestId('sign-in-button').click();

    // Should stay on auth page and show error
    await expect(page.getByText(/incorrect|invalid|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should sign out and return to login', async ({ page }) => {
    // First sign in
    await page.goto('/');
    await page.getByTestId('email-input').fill('testuser@example.com');
    await page.getByTestId('password-input').fill('TestPass123!');
    await page.getByTestId('sign-in-button').click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

    // Click sign out
    await page.getByTestId('sign-out-button').click();

    // Should return to auth page
    await expect(page.getByTestId('sign-in-button')).toBeVisible({ timeout: 10000 });
  });
});
