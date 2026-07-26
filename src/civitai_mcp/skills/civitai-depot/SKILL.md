---
name: civitai-depot
description: Discover Civitai models and pin weights into the comfyops models depot.
---

# Civitai → comfyops depot

1. `civitai_models_tool(operation=search, query=..., types=LORA|Checkpoint)`
2. `get` / `version_get` for file sizes and hashes
3. `outbox_enqueue` with `version_id` + `model_type`
4. Human approve → `outbox_publish` (download)
5. Generate in **comfyops-mcp** using the depot path

Dry-run by default. Token required for real downloads.
