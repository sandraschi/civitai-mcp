# civitai-mcp

Civitai marketplace MCP for the sandraschi fleet — **search / catalog / download** checkpoints & LoRAs into a **comfyops-compatible models depot**. Complements [comfyops-mcp](https://github.com/sandraschi/comfyops-mcp) (run graphs there; discover weights here).

**v0.1.0** · Private · Ports **11124** / **11125**

> FastMCP 3.4+ · dry-run default · human-approved download outbox · SOTA webapp

## Principle

Agents search Civitai freely (public API). Large weight downloads go through **outbox approve → publish**. Live downloads need `CIVITAI_API_TOKEN`. Point `CIVITAI_DEPOT_DIR` (or `COMFYOPS_MODELS_DIR`) at your ComfyUI `models/` tree.

## Features

- `civitai_models` portmanteau: search, get, version_get, creators, tags, download, pin_comfyops, list_local, outbox_*
- Type → folder mapping (`loras/`, `checkpoints/`, `vae/`, …)
- Prefab `show_depot_card`
- Webapp: Dashboard, Browse (Timelines), Download queue (Outbox), Tools, Skills, Chat, Settings, Help

## Quick start

```powershell
cd D:\Dev\repos\civitai-mcp
Copy-Item .env.example .env
# set CIVITAI_API_TOKEN for downloads; optional CIVITAI_DEPOT_DIR
uv sync
.\start.bat
```

Dashboard: http://127.0.0.1:11125

## Docs

See [docs/](docs/) — especially [ONBOARDING.md](docs/ONBOARDING.md) and [TOOLS.md](docs/TOOLS.md).
