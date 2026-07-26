# civitai-mcp PRD

**Status:** Implemented (v0.1.1)  
**Ports:** 11124 backend / 11125 webapp  
**Visibility:** Private (`.nopublish`)

## Goal

Human-approved Civitai outbox for fleet promotion drafts. Agents enqueue; humans approve; publish respects dry-run.

## Non-goals

- Auto-posting / AI spam
- Civitai (separate later)
- GitHub Actions minutes on private (workflow file present; Actions disabled)

## Functional

| Area | Requirement |
|------|-------------|
| Outbox | enqueue / approve / reject / publish |
| Portmanteau | post, reply, boost, upload_media, timeline, notifications, accounts, webhooks — **fully implemented** |
| Webhooks | inbound REST + secret; event list |
| Webapp | SOTA catch-them-all pages + AI compose |
| Safety | `CIVITAI_DRY_RUN=1` default |
| Quality | `just ci` green (ruff, biome, pytest, tsc) |

## Docs

See `docs/` — CONFIGURATION, TOOLS, DEVELOPMENT, TROUBLESHOOTING.
