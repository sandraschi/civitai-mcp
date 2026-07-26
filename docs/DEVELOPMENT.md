# Development — civitai-mcp

Windows-first. Use PowerShell (no bash pipes in scripts).

## Setup

```powershell
cd D:\Dev\repos\civitai-mcp
uv sync --extra dev
cd webapp
npm install
```

## Declared doubles

Live Civitai needs `CIVITAI_INSTANCE` + `CIVITAI_ACCESS_TOKEN` (instance web/app setup first). CI and default local runs use **declared** substitutes only:

| Double | Where | Behavior |
|--------|--------|----------|
| `CIVITAI_DRY_RUN=1` | product default | Write ops return success with `"dry_run": true` — no HTTP to instance |
| `isolated_data` fixture | `tests/conftest.py` | Temp `CIVITAI_DATA_DIR`, dry_run on, tokens cleared |
| Empty notifications | dry_run + no token | `notifications: []` + explicit message — not fabricated inbox rows |
| Webhook without secret | dry_run only | Inbound accepted only while dry_run; secret required for live |
| Mock-until-onboarded UI | webapp when not configured | `lib/mockOnboarding.ts` — MOCK badges; Joe Mocky / Sandra Mockinger; cleared when `instance_configured` |

No undeclared `unittest.mock` / respx layers in this repo today. If you add HTTP mocks for live-path unit tests, name the fixture and add a row here.

## Quality gate (must be green before done)

```powershell
just ci
```

Runs: `ruff check`, `ruff format --check`, `pytest`, webapp `tsc`, `biome check`.

Individual:

```powershell
uv run ruff check src tests
uv run ruff format --check src tests
uv run python -m pytest -q
cd webapp
npm run check
npm run biome:ci
```

## Run locally

```powershell
.\start.bat
# or
.\start.ps1
```

## Packaging

- MCPB: `just mcpb-pack`
- Tauri NSIS: `just build-native` (needs icons)

## CI

`.github/workflows/ci.yml` — **Windows-only**, lightweight (ruff + biome + pytest + tsc).

This repo is **private**: account-level Actions stay disabled (no billing). The workflow file is still required for gate parity and lights up if the repo becomes public. Always run `just ci` locally.
