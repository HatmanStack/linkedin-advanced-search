import { test, expect } from './fixtures/auth.fixture';

test.describe('Connections', () => {
  test('should display connections list after sign in', async ({ authenticatedPage }) => {
    // Dashboard should show connections list
    await expect(authenticatedPage.getByTestId('connections-list')).toBeVisible({ timeout: 15000 });
    await expect(authenticatedPage.getByText('Your Connections')).toBeVisible();
  });

  test('should filter connections by status', async ({ authenticatedPage }) => {
    // Wait for connections to load
    await expect(authenticatedPage.getByTestId('connections-list')).toBeVisible({ timeout: 15000 });

    // Click the status filter dropdown
    await authenticatedPage.getByTestId('status-filter').click();

    // Select a status option (e.g., "Connected" for ally status)
    await authenticatedPage.getByText('Connected').click();

    // Filter should be applied — verify the dropdown shows the selected status
    await expect(authenticatedPage.getByTestId('status-filter')).toContainText('Connected');
  });
});
