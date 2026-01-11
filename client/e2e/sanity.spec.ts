import { test, expect } from '@playwright/test';

test.describe('Concordia Shrine Sanity Check', () => {
    test('should load the landing page', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Concordia Shrine/);

        // Verify main heading exists
        await expect(page.getByRole('heading', { name: 'Concordia Shrine' })).toBeVisible();
    });

    test('should show start recording button', async ({ page }) => {
        await page.goto('/');
        // The button text found in ControlPanel.tsx is "録音開始"
        const startButton = page.getByRole('button', { name: /録音開始/i });
        await expect(startButton).toBeVisible();
    });

    // Note: This test requires microphone permissions which are hard to mock in headless
    // We will skip it for now or we need to launch with args to fake audio
    test.skip('should start a session', async ({ page }) => {
        await page.goto('/');

        // Click start button
        await page.getByRole('button', { name: /録音開始/i }).click();

        // Verify session started
        // The button should change to "録音停止" (Stop Recording)
        const stopButton = page.getByRole('button', { name: /録音停止/i });
        await expect(stopButton).toBeVisible();
    });
});
