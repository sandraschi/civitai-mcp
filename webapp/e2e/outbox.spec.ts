import { expect, test } from "@playwright/test"

test.describe("civitai-mcp webapp + outbox e2e", () => {
  test("backend health", async ({ request }) => {
    const r = await request.get("http://127.0.0.1:11124/api/health")
    expect(r.ok()).toBeTruthy()
    const j = await r.json()
    expect(j.status).toBe("ok")
    expect(j.dry_run).toBeTruthy()
  })

  test("fleet-PR inbound → outbox → approve → dry publish", async ({ request }) => {
    const enq = await request.post("http://127.0.0.1:11124/api/v1/outbox", {
      data: {
        schema_version: 1,
        source: "fleet-public-relations-mcp",
        repo_id: "mixx-dj-mcp",
        campaign: "e2e",
        status_text: "E2E Mixxx MCP pointer — no hype.",
        visibility: "public",
      },
    })
    expect(enq.ok()).toBeTruthy()
    const { id } = await enq.json()
    expect(id).toBeTruthy()

    const appr = await request.post(`http://127.0.0.1:11124/api/v1/outbox/${id}/approve`)
    expect(appr.ok()).toBeTruthy()

    const pub = await request.post(`http://127.0.0.1:11124/api/v1/outbox/${id}/publish`)
    expect(pub.ok()).toBeTruthy()
    const body = await pub.json()
    expect(body.success).toBeTruthy()
    expect(body.dry_run).toBeTruthy()
  })

  test("notifications inbox dry empty", async ({ request }) => {
    const r = await request.get("http://127.0.0.1:11124/api/v1/notifications")
    expect(r.ok()).toBeTruthy()
    const j = await r.json()
    expect(j.success).toBeTruthy()
    expect(j.notifications).toEqual([])
  })

  test("Dashboard and Outbox pages load; enqueue via Compose", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("dashboard")).toBeVisible()

    await page.goto("/outbox")
    await expect(page.getByRole("heading", { name: "Outbox" })).toBeVisible()

    await page.goto("/compose")
    await expect(page.getByRole("heading", { name: "Compose" })).toBeVisible()
    await page.locator("textarea").fill("Playwright enqueue — useful pointer only.")
    await page.getByRole("button", { name: /Enqueue to outbox/i }).click()
    await expect(page.locator("pre")).toContainText("pending")

    await page.goto("/outbox")
    await expect(page.getByText("Playwright enqueue")).toBeVisible({ timeout: 10_000 })
  })
})
