# Changelog

## v0.1.1 (2026-07-26)

- SOTA webapp catch-them-all: Dashboard (hero + KPIs), Inbox, Tools, Skills, Chat, Help page, Logs modal
- Settings: LLM provider/model probe (Ollama / LM Studio / vLLM)
- Compose: AI assist via `POST /api/compose/assist`
- REST: `/api/dashboard`, `/api/skills`, `/api/tools`, `/api/llm/*`, `/api/logs`
- **Full tools** (no planned stubs): `reply`, `boost`, `upload_media`, webhook inbound + list, push subscription get
- docs/: CONFIGURATION, DEVELOPMENT, TOOLS, TROUBLESHOOTING
- Windows-only CI workflow + `just ci` (ruff + biome + pytest + tsc)
- `CIVITAI_WEBHOOK_SECRET` + `POST /api/v1/webhooks/inbound`

## v0.1.0 (2026-07-26)

- Initial FastMCP 3.4+ Civitai bridge with human-approved outbox
- REST handoff for fleet-public-relations-mcp (`POST /api/v1/outbox`)
- Dark webapp: Outbox, Compose, Timelines, Accounts, Settings
- Dry-run default; notifications inbox dry stub
- Tests: pytest API/outbox/portmanteau + Playwright e2e
- MCPB pack, Tauri/NSIS scaffold, FleetStartMode launcher
- Ports 11124/11125 registered in WEBAPP_PORTS.md
- Private (`.nopublish`) — no GitHub Actions
