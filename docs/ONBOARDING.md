# Onboarding — civitai-mcp

## What this is for

**civitai-mcp** finds and downloads generative models (checkpoints, LoRAs, VAEs, …) from [Civitai](https://civitai.com) into a local depot laid out for **ComfyUI / comfyops-mcp**. It does **not** run workflows — use comfyops for that.

## Cost

| Question | Answer |
|----------|--------|
| Account? | Optional for search; **required API token for downloads** |
| Free? | Civitai API keys are free for personal use; models may have license terms |
| Credit card? | Not for API key itself |

## Setup

1. Create an API key at https://civitai.com/user/account
2. ```powershell
   cd D:\Dev\repos\civitai-mcp
   Copy-Item .env.example .env
   ```
3. Set `CIVITAI_API_TOKEN=...`
4. Optionally set `CIVITAI_DEPOT_DIR` or `COMFYOPS_MODELS_DIR` to your ComfyUI `models` folder
5. Keep `CIVITAI_DRY_RUN=1` until ready
6. `.\start.bat` → http://127.0.0.1:11125

## Pitfalls

- Downloads without a token fail (search still works)
- Live downloads require outbox approve when `CIVITAI_REQUIRE_DOWNLOAD_APPROVAL=1`
- Respect model licenses / NSFW filters (`CIVITAI_NSFW=0` default)
