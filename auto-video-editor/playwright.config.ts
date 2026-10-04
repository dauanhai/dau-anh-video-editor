import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 180000,
  use: {
    headless: true,
    viewport: { width: 1360, height: 900 },
    launchOptions: {
      executablePath: process.env.DAU_ANH_BROWSER,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  reporter: "list",
});
