import { expect, test } from "@playwright/test"

const BE = "http://127.0.0.1:11124"

test.describe("civitai-mcp webapp + queue e2e", () => {
  test("backend health", async ({ request }) => {
    const r = await request.get(`${BE}/api/health`)
    expect(r.ok()).toBeTruthy()
    const j = await r.json()
    expect(j.status).toBe("ok")
    expect(j.dry_run).toBeTruthy()
  })

  test("queue approval cycle: enqueue -> approve -> reject", async ({ request }) => {
    const enq = await request.post(`${BE}/api/v1/outbox`, {
      data: {
        schema_version: 1,
        source: "e2e",
        repo_id: "e2e-test",
        campaign: "e2e",
        status_text: "E2E download approval - no download.",
        visibility: "public",
        version_id: 0,
        model_type: "LORA",
      },
    })
    expect(enq.ok()).toBeTruthy()
    const { id } = await enq.json()
    expect(id).toBeTruthy()

    const list = await request.get(`${BE}/api/v1/outbox`)
    expect(list.ok()).toBeTruthy()
    const lj = await list.json()
    expect(lj.items.some((i: { id: number; status: string }) => i.id === id && i.status === "pending")).toBeTruthy()

    const appr = await request.post(`${BE}/api/v1/outbox/${id}/approve`)
    expect(appr.ok()).toBeTruthy()
    expect((await appr.json()).success).toBeTruthy()

    const rej = await request.post(`${BE}/api/v1/outbox/${id}/reject`)
    expect(rej.ok()).toBeTruthy()
    expect((await rej.json()).success).toBeTruthy()
  })

  test("publish requires approval (no network needed to verify the gate)", async ({ request }) => {
    const enq = await request.post(`${BE}/api/v1/outbox`, {
      data: {
        schema_version: 1,
        source: "e2e",
        repo_id: "e2e-test",
        campaign: "e2e",
        status_text: "E2E publish gate - no download.",
        visibility: "public",
        version_id: 0,
        model_type: "LORA",
      },
    })
    expect(enq.ok()).toBeTruthy()
    const { id } = await enq.json()

    const pub = await request.post(`${BE}/api/v1/outbox/${id}/publish`)
    const body = await pub.json()
    expect(body.success).toBeFalsy()
    expect(body.error).toContain("approved")
  })

  test("Dashboard, Queue, Search and Depot pages load", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("dashboard")).toBeVisible()

    await page.goto("/queue")
    await expect(page.getByRole("heading", { name: "Queue" })).toBeVisible()

    await page.goto("/search")
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible()

    await page.goto("/depot")
    await expect(page.getByRole("heading", { name: "Depot" })).toBeVisible()
  })
})
