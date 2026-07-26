# civitai-mcp — Claude / agent context

Private Civitai marketplace MCP. Ports **11124** / **11125**.

## Do

- Queue fleet-PR drafts via outbox; require human approve before publish
- Keep `CIVITAI_DRY_RUN=1` unless Sandra explicitly wants a live post
- Follow FLEET_PROMOTION.md tone

## Don't

- Auto-post from scraper-mcp or CI
- Call Civitai API from fleet-public-relations-mcp (handoff only)
- Add GitHub Actions while `.nopublish` / private
- Civitai here

## Commands

```powershell
.\start.ps1
uv run pytest tests/ -q
just mcpb-pack
```

See AGENTS.md, PRD.md, llms-full.txt.
