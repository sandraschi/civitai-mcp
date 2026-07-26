# civitai-mcp User Tutorials

Welcome to civitai-mcp — your human-in-the-loop Civitai marketplace bridge for the sandraschi fleet. This guide walks you from zero to confidently approving and publishing promotion drafts, using the webapp, and talking to your agent without accidentally spamming the timeline.

## Who this is for

You have or want a Civitai account. You build MCP servers and sometimes want to share them on the Civitai marketplace without sounding like a bot farm. You use Claude Desktop or Cursor with MCP. You may receive drafts from fleet-public-relations-mcp. You want dry-run safety until you explicitly go live.

## What you are not getting

This is not Civitai. This will not auto-post from CI. This will not grow your follower count. This will not write viral threads for you. It gives you an outbox, tools, and a web dashboard so **you** decide what goes public.

---

## Tutorial 1: First-time onboarding (instance + token)

### Step 1 — Get a Civitai account

Pick an instance (Civitai.social, fosstodon.org, or your own). Create an account. Verify email if required. Log in via browser.

Cost: most public instances are free. No credit card for typical signup.

### Step 2 — Create a development application

In the web UI: **Preferences → Development → New application**.

- Application name: `civitai-mcp`
- Scopes: check `read`, `write:statuses`, `write:media`
- Submit and copy the **access token** immediately (shown once)

If you skip write scopes, media upload and posting will fail with HTTP 403 later.

### Step 3 — Clone and configure the repo

Open PowerShell:

```powershell
cd D:\Dev\repos\civitai-mcp
Copy-Item .env.example .env
notepad .env
```

Set:

```
CIVITAI_INSTANCE=https://your.instance.here
CIVITAI_ACCESS_TOKEN=paste_token_here
CIVITAI_DRY_RUN=1
CIVITAI_REQUIRE_OUTBOX_APPROVAL=1
```

Keep dry-run at 1 for your first session.

### Step 4 — Start the server

From the repo root on Windows:

```powershell
.\start.bat
```

Or explicitly:

```powershell
cd D:\Dev\repos\civitai-mcp
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
```

`start.bat` simply delegates to `start.ps1` in the same directory. Backend listens on **11124**, webapp on **11125**.

Open browser: http://127.0.0.1:11125

### Step 5 — Verify health

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health
```

Expect `"instance_configured": true` after token + instance are set. Restart backend if you edited `.env` while it was running.

### Step 6 — Settings page

In the webapp **Settings**, confirm instance shows configured. LLM provider probe is separate — optional for Compose/Chat.

### Onboarding complete

Once configured, MOCK badges on Dashboard and Inbox disappear. Real notifications and timelines require live API calls — still dry-run for writes until you flip env.

---

## Tutorial 2: Dry-run vs live

**Dry-run (`CIVITAI_DRY_RUN=1`)** — default, recommended for weeks of testing.

- Write tools return `"success": true, "dry_run": true`
- Nothing appears on your Civitai profile
- Works even without token for writes (reads still need token)
- Outbox publish simulates success and shows message about dry-run

**Live (`CIVITAI_DRY_RUN=0`)** — only when you mean it.

1. Edit `.env`: `CIVITAI_DRY_RUN=0`
2. Stop and restart via `start.bat`
3. Confirm health shows `"dry_run": false`
4. Approve and publish a test draft you are willing to show publicly

Common mistake: seeing "publish succeeded" in dry-run and searching the web profile for the post. Always check the JSON for `"dry_run": true`.

Per-call override: agents can pass `"dry_run": true` on a tool call even in live env for one-off tests.

---

## Tutorial 3: Outbox approve and publish flow

### Scenario A — Manual compose

1. Open **Compose** in webapp
2. Write a short draft about an MCP repo (concrete, no hype)
3. Click enqueue — row appears in **Outbox** as pending
4. Review text against FLEET_PROMOTION tone
5. Click **Approve**
6. Click **Publish** — still dry-run until env flipped

### Scenario B — fleet-public-relations-mcp handoff

1. PR MCP queues fediverse payload → lands as pending in outbox
2. Open **Outbox** or ask agent: "show pending Civitai drafts"
3. Agent calls `outbox_list` or `show_outbox_card`
4. You edit if needed (reject with reason or fix in Compose)
5. You say explicitly: "approve outbox 7"
6. Agent calls `outbox_approve` with id 7
7. You say: "publish outbox 7 live" only when dry-run is off
8. Agent calls `outbox_publish`

Never let the agent approve or publish without your explicit instruction.

### Scenario C — MCP tool sequence

Ask Claude:

> List my Civitai outbox, then approve item 3 if the tone looks OK — wait for me before publish.

Good agent obeys: lists first, waits for your tone OK, approves only after confirmation, refuses to publish until you say live.

### Rejecting

If draft says "revolutionary game-changing AI": reject.

Webapp: Reject button + reason.

Agent: `outbox_reject` with `reason: "Remove hype words; see FLEET_PROMOTION"`.

---

## Tutorial 4: Compose AI assist

Compose page can call local LLM to tighten drafts.

**Prerequisite:** Ollama on http://127.0.0.1:11434 with a model (default config uses `qwen3:14b`).

Steps:

1. Write rough draft in Compose
2. Click AI assist (or use REST `POST /api/compose/assist`)
3. Review suggestion — it is not auto-posted
4. Edit further manually if needed
5. Enqueue to outbox

If assist fails, check Settings provider probe and start Ollama:

```powershell
ollama serve
```

AI assist follows Civitai-outbox skill + FLEET_PROMOTION rules: removes hype, keeps concrete pointers.

---

## Tutorial 5: Chat skill-first

The **Chat** page proxies to local LLM via `/api/llm/chat`. It is skill-first — meant to answer questions about outbox flow, Civitai ops, and fleet promotion tone using bundled skills context.

Better prompts:

- "Walk me through approving a fleet-PR draft step by step."
- "Rewrite this toot to remove hype: …"
- "What does dry_run mean in civitai-mcp?"

Weaker prompts:

- "Post this now" (agent should refuse without outbox path)
- "Approve everything pending" (agent should refuse)

Configure provider in Settings if not using Ollama 11434.

---

## Tutorial 6: Inbox MOCK-until-onboarded

Before `CIVITAI_INSTANCE` + token are set:

- **Inbox** shows fake notifications from **Joe Mocky** and **Sandra Mockinger**
- Yellow **MOCK** badges appear
- Dashboard KPIs may show sample numbers

This is declared mock data from `webapp/src/lib/mockOnboarding.ts` — not the Civitai marketplace.

After onboarding:

- Mock rows vanish
- Real notifications load from Civitai API (may be empty — that is OK)
- Empty inbox means no notifications, not a broken server

Tell your agent: "Ignore MOCK inbox until I finish onboarding."

---

## Tutorial 7: Timelines and social ops

**Timelines** page: home, local, public. Requires configured token.

Agent operations:

- `timeline` with `timeline: home` — see follows
- `reply` with `in_reply_to_id` from a real status
- `boost` with `status_id` from timeline

Always fetch before replying — do not invent status ids.

---

## Tutorial 8: Media upload workflow

1. Prepare image on the machine running civitai-mcp backend
2. Agent or you: `upload_media` with `media_path` and `media_description`
3. Note returned media id
4. Enqueue or post with `media_ids: ["id"]`

Dry-run returns synthetic `dry-run-media` id for testing attachment flow.

---

## Tutorial 9: Webhooks for fleet integrations

Set in `.env`:

```
CIVITAI_WEBHOOK_SECRET=your_long_random_secret
```

External tool POSTs:

```
POST http://127.0.0.1:11124/api/v1/webhooks/inbound
Header: X-Civitai-Webhook-Secret: your_long_random_secret
Body: {"source":"my-tool","event_type":"release","payload":{"tag":"v1.0"}}
```

View log via webhooks list or agent `webhook_list`.

Without secret, inbound only works in dry-run mode — fine for local dev, not for exposed servers.

---

## Tutorial 10: Troubleshooting

| Problem | Fix |
|---------|-----|
| Publish OK but no toot | `CIVITAI_DRY_RUN=1` — expected |
| Direct post blocked | Use outbox flow |
| Timeline error not configured | Finish onboarding |
| 403 on post | Regenerate token with write scopes |
| Chat/assist fails | Start Ollama or LM Studio |
| Port in use | `start.ps1` tries to clear 11124/11125; kill stray python/node |
| Webhook rejected | Match secret header |
| MOCK data still showing | Health must show instance_configured |

Logs: `GET /api/logs` or Logger modal in webapp.

Run tests:

```powershell
cd D:\Dev\repos\civitai-mcp
uv run pytest tests/ -q
```

---

## Example agent dialogues

### Dialogue 1 — Pending drafts

**You:** What's waiting in my Civitai outbox?

**Agent:** Calls `show_outbox_card` or `civitai_models_tool` operation `outbox_list`. Summarizes pending rows with repo_id and first line of status_text. Reminds you publish requires approve + dry-run off.

### Dialogue 2 — Safe test publish

**You:** Enqueue a test draft "Hello Civitai marketplace from civitai-mcp dry-run test" and approve it but do not go live.

**Agent:** `outbox_enqueue` → `outbox_approve` → `outbox_publish` with dry_run true or env dry. Reports dry_run success. Does not suggest flipping live flag.

### Dialogue 3 — Tone fix

**You:** Reject outbox 5 — too much hype.

**Agent:** `outbox_reject` outbox_id 5 reason "Hype — remove 'game changer' per FLEET_PROMOTION". Suggests editing in Compose with AI assist.

### Dialogue 4 — Read home timeline

**You:** Show me my home timeline last 5 posts.

**Agent:** `timeline` home. Summarizes statuses with ids if you want to reply.

### Dialogue 5 — Help

**You:** What ports does civitai-mcp use?

**Agent:** `civitai_help` → 11124 backend, 11125 frontend, outbox flow summary.

### Dialogue 6 — Onboarding check

**You:** Am I configured?

**Agent:** `accounts_list` → reports instance URL and configured boolean.

### Dialogue 7 — Fleet handoff

**You:** fleet-PR just queued a kicad-mcp draft — walk me through review.

**Agent:** Lists outbox filtered mentally for kicad-mcp, pastes status_text, checks FLEET_PROMOTION checklist, waits for your approve/reject decision.

### Dialogue 8 — Boost

**You:** Boost status 123456789 on my instance (dry-run).

**Agent:** `boost` status_id 123456789 dry_run true. Confirms simulated boost.

---

## Windows paths cheat sheet

| Item | Path |
|------|------|
| Repo root | `D:\Dev\repos\civitai-mcp` |
| Start script | `D:\Dev\repos\civitai-mcp\start.bat` |
| PowerShell start | `D:\Dev\repos\civitai-mcp\start.ps1` |
| Env file | `D:\Dev\repos\civitai-mcp\.env` |
| Data / outbox DB | `D:\Dev\repos\civitai-mcp\data\outbox.sqlite3` |
| Webapp URL | http://127.0.0.1:11125 |
| API health | http://127.0.0.1:11124/api/health |
| MCP HTTP | http://127.0.0.1:11124/mcp |

---

## Claude Desktop MCPB install (brief)

Build bundle: `just mcpb-pack` from repo root. Drag `.mcpb` into Claude Desktop. Ensure `.env` or Claude env vars set for instance/token. System prompt assets load from `assets/prompts/system.md` when packaged.

---

## Daily workflow suggestion

1. Morning: open Dashboard — any pending fleet drafts?
2. Review tone — reject or edit hype
3. Approve good drafts
4. Batch publish only when dry-run off and you accept public visibility
5. Check notifications for replies worth manual follow-up (not agent auto-reply spam)

---

## Closing reminders

- Dry-run is a feature, not a bug
- Outbox approval protects your reputation
- FLEET_PROMOTION tone keeps skeptics from muting you
- MOCK inbox until onboarded — do not panic
- start.bat is the Windows front door

Happy careful tooting.


## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.



## Extended walkthrough: Your first week

**Day 1:** Install, configure `.env`, start `start.bat`, confirm health, explore MOCK dashboard — know it is fake.

**Day 2:** Enqueue three manual drafts in Compose (no publish). Practice approve/reject in Outbox UI.

**Day 3:** Connect Claude Desktop MCP. Ask agent to `outbox_list`. Do not approve yet.

**Day 4:** Run Compose AI assist on a rough draft about any MCP repo you maintain. Compare before/after for hype removal.

**Day 5:** If fleet-PR queued something, review together with agent using FLEET_PROMOTION checklist.

**Day 6:** Still dry-run. Practice `timeline` home and `notifications` — learn your instance.

**Day 7:** If ready, set `CIVITAI_DRY_RUN=0`, restart, publish one short honest pointer post you wrote yourself — not the agent alone.

## FAQ

**Q: Can the agent post without me?**  
A: Not safely — outbox approval and your explicit publish command are required by design.

**Q: Does scraper-mcp post for me?**  
A: No. Never wire scrapers to publish.

**Q: Civitai?**  
A: Different MCP later. Do not use civitai-mcp for Civitai marketplacecol.

**Q: Multiple accounts?**  
A: Single account via env today; `CIVITAI_ACCOUNTS_JSON` reserved for future multi-account.

**Q: Where is FLEET_PROMOTION.md?**  
A: Fleet standard at mcp-central-docs/standards/FLEET_PROMOTION.md — read before approving promotion drafts.

## PowerShell one-liners (reference)

Check health:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/health | ConvertTo-Json
```

List outbox via REST:

```powershell
Invoke-RestMethod http://127.0.0.1:11124/api/v1/outbox
```

Restart after env change: close terminal running start.ps1, run `start.bat` again.

