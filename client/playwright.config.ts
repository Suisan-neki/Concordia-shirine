import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npx vite',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        cwd: '..',
        env: {
            OAUTH_SERVER_URL: 'http://localhost:3000', // Dummy URL for E2E
            DATABASE_URL: 'file:./test.db', // Dummy DB if needed
            VITE_COGNITO_DOMAIN: 'https://mock-auth.example.com',
            VITE_COGNITO_CLIENT_ID: 'mock-client-id',
        },
    },
});
