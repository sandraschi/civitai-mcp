# Configuration — civitai-mcp

Copy `.env.example` to `.env` and edit.

| Variable | Default | Purpose |
|----------|---------|---------|
| `CIVITAI_INSTANCE` | — | Base URL, e.g. `https://civitai.com` |
| `CIVITAI_ACCESS_TOKEN` | — | App token (`read`, `write:statuses`, `write:media`, `push` optional) |
| `CIVITAI_DRY_RUN` | `1` | `1` = simulate writes; `0` = live |
| `CIVITAI_REQUIRE_OUTBOX_APPROVAL` | `1` | Block direct `post` without outbox |
| `CIVITAI_BACKEND_PORT` | `11124` | FastAPI + MCP |
| `CIVITAI_DATA_DIR` | `%LOCALAPPDATA%\civitai-mcp` | SQLite outbox + webhooks |
| `CIVITAI_WEBHOOK_SECRET` | — | Shared secret for `POST /api/v1/webhooks/inbound` |
| `CIVITAI_LOG_LEVEL` | `INFO` | Logging |
| `PORT` | (backend port) | Override bind port (Tauri / packagers) |

Frontend Vite port is **11125** (fixed in `webapp/vite.config.ts` / `start.ps1`).

Claude Desktop / Cursor `env` block should pass the same keys when using stdio or HTTP MCP.
