# civitai-mcp System Guide

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

