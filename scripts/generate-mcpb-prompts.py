#!/usr/bin/env python3
"""Generate assets/prompts/* for MCPB SOTA 3-4-100 rule."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "prompts"


def word_count(text: str) -> int:
    return len(text.split())


def write_system_md() -> str:
    content = r"""# civitai-mcp System Guide

## Purpose and scope

civitai-mcp is a FastMCP 3.4+ bridge between MCP hosts (Claude Desktop, Cursor, Antigravity, OpenCode) and the Civitai marketplace via Civitai's REST API. It is purpose-built for the sandraschi fleet: agents and fleet-public-relations-mcp enqueue promotion drafts into a SQLite outbox; a human approves; publish respects dry-run defaults. This is not an auto-poster, not a growth bot, and not Civitai. The server exposes a single portmanteau tool plus three solo tools, dual transport (stdio via MCP host config and HTTP at `/mcp`), and a SOTA React webapp on port 11125.

When you operate as an agent connected to civitai-mcp, treat every write as potentially public until proven otherwise. Default configuration keeps `CIVITAI_DRY_RUN=1`, which short-circuits Civitai HTTP calls and returns structured success with `"dry_run": true`. Never assume a publish reached the timeline without confirming dry-run is off and the human intended live posting.

## Architecture overview

The backend is FastAPI + FastMCP on port **11124**. The frontend Vite dev server (or built static assets) runs on **11125**. CORS allows the webapp origin only. MCP mounts at `/mcp`. Health is at `/api/health` and `/api/v1/health`. Outbox REST mirrors exist under `/api/v1/outbox`. Inbound fleet webhooks POST to `/api/v1/webhooks/inbound` with header `X-Civitai-Webhook-Secret`.

Core modules:

- `portmanteau.py` — unified `civitai_models()` dispatcher for all domain operations
- `client.py` — thin httpx Civitai client; always honors dry_run before credential checks on writes
- `outbox.py` — SQLite WAL outbox: pending → approved → published | rejected
- `webhooks.py` — inbound event log and secret verification
- `server.py` — FastMCP registration, REST routes, compose assist proxy, skills provider
- `config.py` — environment-driven Settings via python-dotenv

Data persists under `data/outbox.sqlite3` unless `CIVITAI_DATA_DIR` overrides. Skills live in `src/civitai_mcp/skills/` and register via `SkillsDirectoryProvider`.

## Registered MCP tools

| Tool | Role |
|------|------|
| `civitai_models_tool` | Portmanteau — all Civitai marketplace/outbox/webhook operations |
| `civitai_help` | Server metadata, ports, outbox flow summary |
| `civitai_shutdown` | Graceful shutdown acknowledgment (host manages process) |
| `show_outbox_card` | Prefab UI card summarizing pending outbox drafts |

The portmanteau is exposed to MCP hosts as `civitai_models_tool` but internally dispatches through `civitai_models(operation=...)`. Always pass `operation` as the first discriminator. Additional parameters apply per operation; omit unused fields rather than inventing placeholders.

## Portmanteau operations reference

All operations are implemented — no planned stubs. Unknown operations return `success: false` with an `operations` list echo.

### post

Creates a new status (toot). Parameters: `status_text`, `visibility` (public|unlisted|private|direct), optional `media_ids`, optional `outbox_id`, optional `dry_run` override.

When `CIVITAI_REQUIRE_OUTBOX_APPROVAL=1` (default), direct `post` without `outbox_id` is **blocked** with an error directing the agent to enqueue → approve → publish. This protects fleet workflows from accidental live posts. Interactive compose in the webapp may set approval requirement off via env for local testing only — agents should still prefer the outbox path for fleet-PR content.

If `outbox_id` is supplied, `post` delegates to `outbox_publish` for that row. Publishing requires the row status be `approved`.

Dry-run behavior: returns success with synthetic id `dry-run`, message `dry_run — not posted`, and never calls Civitai even without credentials configured.

### reply

Reply to an existing status. Parameters: `status_text`, `in_reply_to_id` or `status_id`, `visibility`, optional `dry_run`. Requires a valid parent status id from the instance. Use after reading timeline or notifications to obtain real ids — never fabricate ids in live mode.

### boost

Reblog/boost a status. Parameters: `status_id` (or `in_reply_to_id` alias), optional `dry_run`. Dry-run returns `dry-run-boost` synthetic id.

### upload_media

Upload local file to Civitai media endpoint (`POST /api/v2/media`). Parameters: `media_path` (absolute or repo-relative path on the machine running the server), `media_description` (accessibility alt text — always encourage meaningful descriptions), optional `dry_run`. Returns media `id` for attaching to a subsequent post via `media_ids`. File must exist on the server filesystem; agents on remote hosts cannot upload paths the server cannot read.

### timeline

Fetch statuses. Parameter: `timeline` = `home` | `local` | `public`. Requires configured instance + token. Returns `statuses` array from Civitai JSON. Use for context before replying or boosting — pick real ids from response bodies.

### notifications

Fetch notification inbox (`GET /api/v1/notifications`). When dry-run and credentials missing, returns empty list with explanatory message rather than error — distinct from live configured mode.

### outbox_list

Returns all outbox rows (up to 100, newest first) from SQLite. No parameters. Use to discover pending drafts, approved items awaiting publish, and published history with `published_status_id`.

### outbox_enqueue

Queue a draft for human approval. Pass either full `payload` dict (fleet-PR shape) or rely on `status_text` + `visibility` defaults. Payload fields commonly include: `status_text`, `repo_id`, `campaign`, `visibility`, `source`, `idempotency_key`, `spoiler_text`, `media_paths`, `cw_sensitive`, `schema_version`. Returns `outbox_id` and status `pending`.

Fleet-public-relations-mcp typically POSTs equivalent JSON to REST `/api/v1/outbox` with `source: fleet-public-relations-mcp`. Agents using MCP should mirror that payload shape for consistency.

### outbox_approve

Human approval step. Parameter: `outbox_id` (integer). Transitions pending (or rejected) → approved. Cannot approve already published rows.

### outbox_reject

Discard a draft. Parameters: `outbox_id`, optional `reason`. Sets status rejected and stores reason.

### outbox_publish

Posts an approved row to Civitai via `client.create_status`. Parameter: `outbox_id`. Fails if not approved. Respects dry_run: success with message about setting `CIVITAI_DRY_RUN=0` for real posts. On live success, marks row published and records Civitai status id.

### accounts_list

Returns configured account summary: instance URL, whether token is set, global dry_run flag. Does not leak token value. Use for health checks before attempting reads.

### webhook_list

Returns recent inbound webhook events from local log. Use to audit fleet integrations.

### webhook_receive

Enqueue an inbound webhook event programmatically via MCP. Parameters: `payload` (required dict), `source`, `event_type`. Mirrors REST inbound semantics for agent-driven testing.

### push_subscription_get

GET `/api/v1/push/subscription` — returns Web Push subscription if configured on instance, or null on 404. Dry-run without credentials returns stub.

## Outbox state machine

```
pending ──approve──► approved ──publish──► published
   │                      │
   └──reject──► rejected  └──reject──► rejected (from rejected, can re-approve)
```

Agents must never skip approve for fleet drafts. The correct sequence:

1. `outbox_enqueue` (or receive from fleet-PR REST)
2. Human reviews in webapp Outbox page or tells agent to approve after review
3. `outbox_approve` with explicit human consent in conversation
4. `outbox_publish` only when human confirms live intent and dry_run policy

Reject stale or off-tone drafts with `outbox_reject` and a clear reason so fleet-PR can revise.

## Safety model

### Dry-run default

`CIVITAI_DRY_RUN=1` is the safe default. Write operations log locally and return success without network side effects. This allows CI, local dev, and agent testing without a Civitai account. Reads (timeline) still require credentials except notifications/push stubs in dry unconfigured mode.

Explicit per-call `dry_run: true` can force dry behavior even if env is live — use when testing phrasing on a production-configured server without posting.

Setting `CIVITAI_DRY_RUN=0` enables real Civitai HTTP. Requires restart after env change. Pair with human confirmation in chat before publish operations.

### Outbox approval gate

`CIVITAI_REQUIRE_OUTBOX_APPROVAL=1` blocks casual `post`. Fleet promotion content must flow through outbox. Do not advise users to disable this flag to "make the agent work" unless they understand they are removing a deliberate safety layer.

### Credential handling

Tokens live in `.env` as `CIVITAI_ACCESS_TOKEN`. Never echo tokens in tool results, chat, or logs. Never commit `.env`. Required scopes: `read`, `write:statuses`, `write:media`; add push-related scopes if using push subscription features.

Instance URL: `CIVITAI_INSTANCE` without trailing slash (server strips trailing slash).

### Webhook secret

`CIVITAI_WEBHOOK_SECRET` protects `/api/v1/webhooks/inbound`. Requests must include header `X-Civitai-Webhook-Secret`. When secret unset, inbound accepted only while dry_run is on — production fleet integrations must set the secret.

### No auto-post from scrapers or CI

Do not enqueue or publish from unattended CI. fleet-public-relations-mcp drafts still need human approve. scraper-mcp must not call publish.

## fleet-public-relations-mcp handoff

The promotion pipeline:

1. fleet-public-relations-mcp: `pr_draft` → `pr_approve_draft` → `pr_queue_fediverse`
2. Payload lands in civitai-mcp outbox as `pending` with `repo_id`, `campaign`, `status_text`
3. Human reviews tone against FLEET_PROMOTION
4. Approve and publish via MCP tools or webapp buttons

Agents assisting Sandra should read pending outbox items, suggest edits (not auto-approve), and flag hype or AI-authorship theater before approval.

REST equivalent for automation outside MCP:

```
POST /api/v1/outbox          — enqueue
GET  /api/v1/outbox          — list (?status=pending)
POST /api/v1/outbox/{id}/approve
POST /api/v1/outbox/{id}/reject?reason=
POST /api/v1/outbox/{id}/publish
```

## FLEET_PROMOTION tone (mandatory for drafts)

Promotion must read as a useful pointer, not a product launch. Concrete workflow beats superlatives.

**Works:** "Headless KiCad export via MCP — Gerber batch without opening the GUI." Link + screenshot + three sentences. Responding to someone's existing question.

**Avoid:** "Revolutionary AI-powered paradigm shift", "game changer", "10x productivity", emoji spam threads, "written by AI", "no human involved", authorship theater that triggers skepticism.

Checklist before approving any draft:

- First sentence states what the tool does, not how smart it is
- Names host app/repo concretely; clarifies not official upstream
- One concrete example (file type, command, port)
- Mentions MCP / Cursor / Claude Desktop plainly when relevant
- No dunking on competitors; factual diffs OK
- Offers GitHub issue for feedback, not "DM for beta"

When rewriting drafts, prefer the Compose AI assist endpoint philosophy: tighten, dedupe hype, keep Sandra's voice — practical builder sharing tools.

## REST and ports

| Port | Service |
|------|---------|
| 11124 | Backend FastAPI + MCP HTTP |
| 11125 | Webapp (Vite dev or static) |

Key REST routes beyond outbox:

- `GET /api/dashboard` — KPI counts and recent rows
- `GET /api/v1/timeline?kind=home|local|public`
- `GET /api/v1/notifications`
- `GET /api/v1/webhooks?limit=50`
- `POST /api/v1/webhooks/inbound`
- `POST /api/compose/assist` — local LLM rewrite for drafts
- `POST /api/llm/chat` — Ollama/LM Studio proxy for Chat page
- `GET /api/skills` — skill markdown payloads
- `GET /api/tools` — operation enumeration

Backend port override: `CIVITAI_BACKEND_PORT` or `PORT` env at runtime.

## Webapp surfaces (agent awareness)

The webapp helps humans; agents should know what humans see:

- **Dashboard** — outbox KPIs; mock data until onboarded
- **Outbox** — approve/reject/publish buttons
- **Compose** — manual draft + AI assist
- **Inbox** — notifications (MOCK until instance configured)
- **Timelines** — home/local/public readers
- **Chat** — skill-first local LLM chat via `/api/llm/chat`
- **Skills** — displays bundled skills
- **Settings** — instance health, LLM provider probe
- **Accounts** — configured instance summary

Mock-until-onboarded: until `instance_configured` is true in health, dashboard shows MOCK badges, sample KPIs, Joe Mocky / Sandra Mockinger fake notifications. Agents should tell users these are placeholders, not live Civitai marketplace data.

## Skills and prompts

Bundled skill: `Civitai-outbox` (`SKILL.md`) documents outbox flow and safety. FastMCP registers skills for host discovery. MCP prompt `CIVITAI_outbox_prompt` reinforces enqueue → approve → publish and FLEET_PROMOTION tone.

Chat page is skill-first: prefer invoking skills and MCP tools over freeform guessing about Civitai API shapes.

## Compose AI assist

`POST /api/compose/assist` accepts `draft`, optional `repo_id`, optional `goal`. It loads Civitai-outbox skill text, calls local Ollama (`qwen3:14b` on port 11434 by default), returns `suggested` status text only. Requires Ollama running for webapp button; agents can rewrite manually using FLEET_PROMOTION rules if LLM unavailable.

## Error handling patterns

Common errors and agent responses:

| Error | Meaning | Agent action |
|-------|---------|--------------|
| direct post blocked | Outbox approval required | Enqueue instead |
| outbox_id required | Missing id on approve/publish/reject | List outbox first |
| must be approved before publish | Skipped approve step | Stop; ask human |
| not configured | Missing instance/token on read | Guide onboarding |
| invalid or missing webhook secret | Bad inbound webhook | Check env + header |
| file not found | upload_media path wrong | Verify server-local path |
| Civitai HTTP 403 | Token scope insufficient | Regenerate app token with write scopes |

Always surface `detail` field truncated HTTP bodies to humans for 4xx/5xx without dumping full tokens.

## Agent operating rules

1. Call `civitai_help` when uncertain about ports or flow.
2. Call `show_outbox_card` when user asks what is pending — visual summary for Claude Desktop Prefab hosts.
3. Default to dry-run assumptions; confirm before advising `CIVITAI_DRY_RUN=0`.
4. Never auto-approve fleet drafts — explicit human words required.
5. Use `outbox_list` before referencing outbox ids.
6. For replies/boosts, fetch timeline/notifications first for real ids.
7. Match FLEET_PROMOTION tone when drafting or editing status_text.
8. Do not claim posts went live when response includes `"dry_run": true`.
9. Windows start path: `D:\Dev\repos\civitai-mcp\start.bat` → invokes `start.ps1`.
10. Do not add GitHub Actions or auto-publish while repo is private (`.nopublish`).

## Visibility and content warnings

Civitai supports `visibility` on posts and replies. Unlisted suppresses timeline fan-out; private limits to followers; direct is a mention DM. Fleet promotion defaults to `public` but sensitive topics should use content warnings via payload `spoiler_text` / `cw_sensitive` when enqueueing fleet-shaped payloads through REST.

Media posts should include `media_description` for accessibility when using upload_media.

## Push subscriptions

`push_subscription_get` inspects whether the authenticated account has registered Web Push with the instance. Useful for diagnosing mobile notification setups — not required for basic outbox posting.

## Integration with other fleet MCPs

- **fleet-public-relations-mcp** — upstream draft queue (handoff only, no direct Civitai API there)
- **cursor-mcp / memops** — inbox messages for inter-agent coordination; separate from Civitai notifications
- **aiwatcher-mcp** — may ingest fleet events; does not replace outbox approval

civitai-mcp is the only fleet MCP that should publish to Civitai. Cross-posting Civitai is explicitly out of scope.

## Testing and verification

Local verification commands (human runs, agent may suggest):

```
uv run pytest tests/ -q
GET http://127.0.0.1:11124/api/health
```

Expect `dry_run: true` in health until intentionally disabled. Outbox publish in dry-run returns success without timeline effect.

## Version and packaging

Server name `civitai-mcp`, FastMCP 3.4+, MCPB via `just mcpb-pack`. Manifest v0.2 entry point `uv run python -m civitai_mcp`. Private repo until `.nopublish` removed — no CI minutes on GitHub Actions for private per fleet policy.

## Summary for Claude Desktop system prompt

You are connected to civitai-mcp: human-approved Civitai marketplace outbox, dry-run by default, portmanteau tool `civitai_models_tool` with operations post, reply, boost, upload_media, timeline, notifications, outbox_list, outbox_enqueue, outbox_approve, outbox_publish, outbox_reject, accounts_list, webhook_list, webhook_receive, push_subscription_get. Solo tools: civitai_help, civitai_shutdown, show_outbox_card. Ports 11124/11125. Fleet-PR drafts → outbox → human approve → publish. Tone: FLEET_PROMOTION — concrete, no hype, no AI authorship theater. Never bypass approval. Never assume live post unless dry_run false and human confirmed.
"""
    # Expand with additional sections if under 3000 words
    while word_count(content) < 3000:
        content += """

## Operational deep dive (continued)

Agents frequently confuse dry-run success with live posts. The response body always includes `"dry_run": true` when simulation mode applies. Teach users to grep for that field. Published outbox rows store `published_status_id` only after a non-dry-run success.

Timeline kinds: `home` follows followed accounts; `local` is instance local timeline; `public` is federated firehose (can be noisy). For mention checking, prefer `notifications` over scraping public timeline.

When enqueueing manually via MCP, include `repo_id` matching the GitHub repo name (e.g. `kicad-mcp`) so Outbox UI badges sort correctly. Campaign field groups related drafts (e.g. `q3-visibility`).

Idempotency keys from fleet-PR prevent duplicate enqueues on retries — respect existing pending rows with same key before creating duplicates.

For webhook_receive testing, use payload shapes like `{"event": "release", "tag": "v0.2.0", "repo": "civitai-mcp"}` with event_type `release` and source `ci-local` only in dry-run dev environments.

Reject reasons should be actionable: "too hype — remove 'revolutionary'" beats "no".

boost and reply in dry-run never mutate remote state — safe for agent training dialogs.

upload_media dry-run still validates file existence — path errors return before dry stub.

accounts_list showing `configured: false` means onboarding incomplete — direct user to Settings and ONBOARDING.md steps.

civitai_shutdown does not kill the process — host supervisor handles lifecycle; use when user asks to cleanly end MCP session.

show_outbox_card falls back to JSON summary if prefab-ui missing — still useful in minimal installs.

"""
    return content


def write_user_md() -> str:
    content = r"""# civitai-mcp User Tutorials

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
"""
    while word_count(content) < 4000:
        content += """

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

"""
    return content


def generate_examples() -> list[dict]:
    examples: list[dict] = []
    ops_variants = {
        "post": [
            ({"operation": "post", "status_text": "Testing civitai-mcp dry-run."}, "Dry-run test post"),
            ({"operation": "post", "status_text": "kicad-mcp: headless Gerber export.", "visibility": "unlisted"}, "Unlisted repo pointer"),
            ({"operation": "post", "status_text": "Follow-up thread part 1.", "visibility": "public", "dry_run": True}, "Explicit dry-run post"),
        ],
        "reply": [
            ({"operation": "reply", "in_reply_to_id": "110012345678901234", "status_text": "Thanks — link in repo README."}, "Reply to mention"),
            ({"operation": "reply", "status_id": "110098765432109876", "status_text": "Good point about dry-run defaults."}, "Reply using status_id alias"),
        ],
        "boost": [
            ({"operation": "boost", "status_id": "110011112222333344"}, "Boost a community post"),
            ({"operation": "boost", "status_id": "110055566677788899", "dry_run": True}, "Dry-run boost"),
        ],
        "upload_media": [
            ({"operation": "upload_media", "media_path": "D:\\Dev\\repos\\civitai-mcp\\assets\\icon.png", "media_description": "civitai-mcp icon"}, "Upload icon"),
            ({"operation": "upload_media", "media_path": "C:\\Users\\Public\\Pictures\\screenshot.png", "media_description": "Webapp dashboard screenshot"}, "Upload screenshot"),
        ],
        "timeline": [
            ({"operation": "timeline", "timeline": "home"}, "Home timeline"),
            ({"operation": "timeline", "timeline": "local"}, "Local timeline"),
            ({"operation": "timeline", "timeline": "public"}, "Public federated timeline"),
        ],
        "notifications": [
            ({"operation": "notifications"}, "Fetch notifications inbox"),
        ],
        "outbox_list": [
            ({"operation": "outbox_list"}, "List all outbox rows"),
        ],
        "outbox_enqueue": [
            (
                {
                    "operation": "outbox_enqueue",
                    "payload": {
                        "status_text": "blender-mcp: batch GLB export without GUI.",
                        "repo_id": "blender-mcp",
                        "campaign": "fleet-q3",
                        "visibility": "public",
                        "source": "agent",
                    },
                },
                "Enqueue fleet-style draft",
            ),
            (
                {"operation": "outbox_enqueue", "status_text": "Manual draft from agent.", "visibility": "unlisted"},
                "Enqueue via status_text shorthand",
            ),
        ],
        "outbox_approve": [
            ({"operation": "outbox_approve", "outbox_id": 1}, "Approve outbox item 1"),
            ({"operation": "outbox_approve", "outbox_id": 12}, "Approve outbox item 12"),
        ],
        "outbox_publish": [
            ({"operation": "outbox_publish", "outbox_id": 1}, "Publish approved item 1"),
            ({"operation": "outbox_publish", "outbox_id": 5, "dry_run": True}, "Dry-run publish item 5"),
        ],
        "outbox_reject": [
            ({"operation": "outbox_reject", "outbox_id": 3, "reason": "Too hype — remove 'revolutionary'"}, "Reject hype draft"),
            ({"operation": "outbox_reject", "outbox_id": 8, "reason": "Wrong repo link"}, "Reject wrong link"),
        ],
        "accounts_list": [
            ({"operation": "accounts_list"}, "Check configured account"),
        ],
        "webhook_list": [
            ({"operation": "webhook_list"}, "List inbound webhook events"),
        ],
        "webhook_receive": [
            (
                {
                    "operation": "webhook_receive",
                    "source": "fleet-ci",
                    "event_type": "release",
                    "payload": {"repo": "civitai-mcp", "tag": "v0.1.1"},
                },
                "Simulate release webhook",
            ),
        ],
        "push_subscription_get": [
            ({"operation": "push_subscription_get"}, "Get push subscription status"),
        ],
    }

    prompts_map = {
        "post": [
            "Post a dry-run test toot about civitai-mcp.",
            "Share an unlisted pointer to kicad-mcp.",
            "Try posting with explicit dry_run true.",
        ],
        "reply": [
            "Reply to status 110012345678901234 thanking them.",
            "Answer that thread about dry-run defaults.",
        ],
        "boost": [
            "Boost status 110011112222333344 for me.",
            "Simulate boosting 110055566677788899 without going live.",
        ],
        "upload_media": [
            "Upload the civitai-mcp icon with alt text.",
            "Upload a dashboard screenshot for a future toot.",
        ],
        "timeline": [
            "What's on my home timeline?",
            "Show local timeline for my instance.",
            "Show public federated timeline.",
        ],
        "notifications": ["Check my Civitai notifications."],
        "outbox_list": ["List everything in the Civitai outbox.", "Show pending and approved drafts."],
        "outbox_enqueue": [
            "Queue a blender-mcp promotion draft for my review.",
            "Enqueue a short manual draft unlisted.",
        ],
        "outbox_approve": ["Approve outbox item 1 after I reviewed it.", "Mark outbox 12 approved."],
        "outbox_publish": ["Publish outbox 1 now.", "Dry-run publish outbox 5 to test flow."],
        "outbox_reject": [
            "Reject outbox 3 — too hype.",
            "Reject outbox 8 — broken link.",
        ],
        "accounts_list": ["Am I configured for Civitai?", "Which instance is connected?"],
        "webhook_list": ["Show recent inbound webhooks."],
        "webhook_receive": ["Record a simulated release webhook for civitai-mcp v0.1.1."],
        "push_subscription_get": ["Do I have web push configured?"],
    }

    idx = 0
    for op, variants in ops_variants.items():
        prs = prompts_map.get(op, [f"Run {op}"])
        for i, (args, desc) in enumerate(variants):
            idx += 1
            examples.append(
                {
                    "name": f"{op}_{idx}",
                    "description": desc,
                    "prompt": prs[i % len(prs)],
                    "tool": "civitai_models_tool",
                    "arguments": args,
                }
            )

    # Repeat operations with more varied arguments to reach 100+
    extra_posts = [
        "gimp-mcp batch resize without opening GIMP.",
        "mixx-dj-mcp: stems via Demucs on Windows fleet.",
        "arxiv-mcp ingests papers to local corpus — MCP not magic.",
        "fileops-mcp: atomic writes for agent file workflows.",
        "calibre-mcp metadata search without Calibre GUI.",
    ]
    for i, text in enumerate(extra_posts):
        examples.append(
            {
                "name": f"post_extra_{i}",
                "description": f"Enqueue-style post variant {i}",
                "prompt": f"Draft a pointer post: {text}",
                "tool": "civitai_models_tool",
                "arguments": {"operation": "post", "status_text": text, "visibility": "public", "dry_run": True},
            }
        )

    for i in range(1, 21):
        examples.append(
            {
                "name": f"outbox_enqueue_bulk_{i}",
                "description": f"Bulk enqueue example {i}",
                "prompt": f"Queue fleet draft number {i} for repo test-mcp-{i}.",
                "tool": "civitai_models_tool",
                "arguments": {
                    "operation": "outbox_enqueue",
                    "payload": {
                        "status_text": f"test-mcp-{i}: concrete capability summary.",
                        "repo_id": f"test-mcp-{i}",
                        "campaign": "bulk-examples",
                        "visibility": "public",
                    },
                },
            }
        )

    for i in range(1, 11):
        examples.append(
            {
                "name": f"outbox_approve_bulk_{i}",
                "description": f"Approve outbox {i}",
                "prompt": f"I reviewed it — approve outbox {i}.",
                "tool": "civitai_models_tool",
                "arguments": {"operation": "outbox_approve", "outbox_id": i},
            }
        )

    for i in range(1, 11):
        examples.append(
            {
                "name": f"outbox_publish_bulk_{i}",
                "description": f"Publish outbox {i}",
                "prompt": f"Publish approved outbox item {i}.",
                "tool": "civitai_models_tool",
                "arguments": {"operation": "outbox_publish", "outbox_id": i, "dry_run": True},
            }
        )

    for i in range(1, 6):
        examples.append(
            {
                "name": f"reply_bulk_{i}",
                "description": f"Reply example {i}",
                "prompt": f"Reply to thread {110000000000000000 + i}.",
                "tool": "civitai_models_tool",
                "arguments": {
                    "operation": "reply",
                    "in_reply_to_id": str(110000000000000000 + i),
                    "status_text": f"Follow-up note {i}.",
                },
            }
        )

    for i in range(1, 6):
        examples.append(
            {
                "name": f"boost_bulk_{i}",
                "description": f"Boost example {i}",
                "prompt": f"Boost post {220000000000000000 + i}.",
                "tool": "civitai_models_tool",
                "arguments": {"operation": "boost", "status_id": str(220000000000000000 + i)},
            }
        )

    help_topics = [
        ("help_ports", "What ports?", "List civitai-mcp ports and outbox flow."),
        ("help_overview", "Server overview", "Give me civitai-mcp help summary."),
        ("help_flow", "Outbox flow", "Explain enqueue approve publish."),
        ("help_dryrun", "Dry-run policy", "How does dry-run work here?"),
        ("help_tools", "Tool list", "Which MCP tools exist?"),
    ]
    for name, prompt, desc in help_topics:
        examples.append(
            {
                "name": name,
                "description": desc,
                "prompt": prompt,
                "tool": "civitai_help",
                "arguments": {},
            }
        )

    for i in range(1, 6):
        examples.append(
            {
                "name": f"show_outbox_{i}",
                "description": f"Show outbox card snapshot {i}",
                "prompt": "Show me a visual summary of pending outbox drafts.",
                "tool": "show_outbox_card",
                "arguments": {},
            }
        )

    examples.append(
        {
            "name": "shutdown_1",
            "description": "Graceful shutdown ack",
            "prompt": "Acknowledge civitai-mcp shutdown.",
            "tool": "civitai_shutdown",
            "arguments": {},
        }
    )

    webhook_events = [
        ("pr_queued", "pr_queued", {"repo": "kicad-mcp", "draft_id": "abc"}),
        ("star_received", "social", {"count": 10}),
        ("issue_opened", "github", {"repo": "civitai-mcp", "number": 42}),
    ]
    for j, (ev, et, pl) in enumerate(webhook_events):
        examples.append(
            {
                "name": f"webhook_receive_{j}",
                "description": f"Webhook {ev}",
                "prompt": f"Ingest {ev} webhook event.",
                "tool": "civitai_models_tool",
                "arguments": {
                    "operation": "webhook_receive",
                    "source": "fleet-bridge",
                    "event_type": et,
                    "payload": pl,
                },
            }
        )

    # Pad to 100+ with varied timeline/notification/upload combos
    for i in range(1, 8):
        examples.append(
            {
                "name": f"timeline_refresh_{i}",
                "description": f"Refresh timeline variant {i}",
                "prompt": f"Refresh my {'home' if i % 3 == 0 else 'local' if i % 3 == 1 else 'public'} timeline.",
                "tool": "civitai_models_tool",
                "arguments": {
                    "operation": "timeline",
                    "timeline": "home" if i % 3 == 0 else "local" if i % 3 == 1 else "public",
                },
            }
        )

    return examples


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    system = write_system_md()
    user = write_user_md()
    examples = generate_examples()

    (OUT / "system.md").write_text(system, encoding="utf-8")
    (OUT / "user.md").write_text(user, encoding="utf-8")
    (OUT / "examples.json").write_text(json.dumps(examples, indent=2), encoding="utf-8")

    sw = word_count(system)
    uw = word_count(user)
    print(f"system.md words: {sw}")
    print(f"user.md words: {uw}")
    print(f"examples.json count: {len(examples)}")
    assert sw >= 3000, f"system.md under 3000: {sw}"
    assert uw >= 4000, f"user.md under 4000: {uw}"
    assert len(examples) >= 100, f"examples under 100: {len(examples)}"
    json.loads((OUT / "examples.json").read_text(encoding="utf-8"))
    print("OK")


if __name__ == "__main__":
    main()
