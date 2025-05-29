import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "./e2e",
  snapshotDir: "./playwright_snapshots",
  timeout: 60 * 1000, // General timeout for tests
  expect: {
    timeout: 5000, // Timeout for expect() assertions
  },
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail build on CI if test.only is present
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: process.env.CI ? 1 : undefined, // Opt out of parallel tests on CI by default.
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "html",

  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 0, // No timeout for actions like click()
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    // Example for adding other browsers:
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },
  ],

  webServer: {
    command: "yarn workspace demo serve --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
    // stdout: 'pipe', // Or 'ignore'
    // stderr: 'pipe', // Or 'ignore'
  },
};

export default config;
