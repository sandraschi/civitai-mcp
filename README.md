# civitai-mcp

<p align="center">
  <a href="https://github.com/casey/just"><img src="https://img.shields.io/badge/just-ready_to_go-7c5cfc?style=flat-square&logo=just&logoColor=white" alt="Just"></a>
  <a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.13+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"></a>
  <a href="https://github.com/PrefectHQ/fastmcp"><img src="https://img.shields.io/badge/FastMCP-3.4%2B-7c5cfc?style=flat-square" alt="FastMCP"></a>
  <a href="https://github.com/sandraschi/civitai-mcp/actions"><img src="https://img.shields.io/github/actions/workflow/status/sandraschi/civitai-mcp/ci.yml?branch=master&style=flat-square" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" alt="MIT"></a>
</p>

Civitai marketplace MCP — **search / catalog / download** checkpoints & LoRAs into a **ComfyUI-compatible models depot**. Complements [comfyops-mcp](https://github.com/sandraschi/comfyops-mcp) (run graphs there; discover weights here).

**v0.1.0** · Ports **11124** / **11125**

> FastMCP 3.4+ · dry-run default · human-approved download outbox · SOTA webapp

## Principle

Agents search Civitai freely (public API). Large weight downloads go through **outbox approve → publish**. Live downloads need `CIVITAI_API_TOKEN`. Point `CIVITAI_DEPOT_DIR` (or `COMFYOPS_MODELS_DIR`) at your ComfyUI `models/` tree.

## Features

- `civitai_models` portmanteau: search, get, version_get, creators, tags, download, pin_comfyops, list_local, outbox_*
- Type → folder mapping (`loras/`, `checkpoints/`, `vae/`, …)
- Prefab `show_depot_card`
- Webapp: Dashboard, Search, Depot, Queue, Tools, Skills, Chat, Settings, Help
  (no social Inbox/Compose — Civitai is a marketplace, not a messenger)

## Quick start

```powershell
git clone https://github.com/sandraschi/civitai-mcp
cd civitai-mcp
Copy-Item .env.example .env
# set CIVITAI_API_TOKEN for downloads; optional CIVITAI_DEPOT_DIR
uv sync
.\start.bat
```

Dashboard: http://127.0.0.1:11125

## Docs

See [docs/](docs/) — especially [ONBOARDING.md](docs/ONBOARDING.md) and [TOOLS.md](docs/TOOLS.md).

## License

MIT
