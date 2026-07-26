# MCP Tool Reference — civitai-mcp

All domain operations go through the **`civitai_models`** portmanteau (registered as `civitai_models_tool`). Solo tools: `civitai_help`, `civitai_shutdown`, `show_outbox_card`.

**No planned stubs.** Every operation listed here is implemented. Dry-run (`CIVITAI_DRY_RUN=1`) short-circuits write ops without credentials.

## Portmanteau operations

| Operation | Params | Behavior |
|-----------|--------|----------|
| `post` | `status_text`, `visibility`, `media_ids`, `outbox_id` | Blocked unless outbox path or `CIVITAI_REQUIRE_OUTBOX_APPROVAL=0` |
| `reply` | `in_reply_to_id` or `status_id`, `status_text` | Reply status |
| `boost` | `status_id` | Reblog |
| `upload_media` | `media_path`, `media_description` | `POST /api/v2/media` → media id |
| `timeline` | `timeline` = home\|local\|public | Fetch statuses |
| `notifications` | — | Inbox notifications |
| `outbox_list` | — | SQLite outbox rows |
| `outbox_enqueue` | `payload` or `status_text` | Fleet-PR handoff shape |
| `outbox_approve` | `outbox_id` | Mark approved |
| `outbox_reject` | `outbox_id`, `reason` | Discard |
| `outbox_publish` | `outbox_id` | Publish approved (respects dry_run) |
| `accounts_list` | — | Configured instance profile |
| `webhook_list` | — | Inbound webhook event log |
| `webhook_receive` | `payload`, `source`, `event_type` | Enqueue inbound event |
| `push_subscription_get` | — | Civitai Web Push subscription |

## REST mirrors

| Method | Path |
|--------|------|
| POST | `/api/v1/outbox` |
| GET | `/api/v1/outbox` |
| POST | `/api/v1/outbox/{id}/approve\|reject\|publish` |
| GET | `/api/v1/notifications` |
| GET | `/api/v1/timeline?kind=` |
| POST | `/api/v1/webhooks/inbound` (header `X-Civitai-Webhook-Secret`) |
| GET | `/api/v1/webhooks` |

## Safety

- Default dry-run: writes return success with `dry_run: true` and do not hit the instance.
- Live writes need `CIVITAI_DRY_RUN=0` plus instance token.
- Inbound webhooks: set `CIVITAI_WEBHOOK_SECRET`; when unset, only accepted while dry_run is on.
