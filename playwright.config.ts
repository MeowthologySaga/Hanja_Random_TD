import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4437);

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    channel: "chrome",
    viewport: { width: 1280, height: 720 },
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 30_000
  }
});
