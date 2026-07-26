import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:11125",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "uv run uvicorn civitai_mcp.server:app --host 127.0.0.1 --port 11124 --log-level warning",
      url: "http://127.0.0.1:11124/api/health",
      cwd: "..",
      timeout: 45_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx vite --host 127.0.0.1 --port 11125",
      url: "http://127.0.0.1:11125",
      timeout: 45_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
