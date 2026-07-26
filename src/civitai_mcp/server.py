"""civitai-mcp FastMCP + FastAPI — ports 11124 (HTTP/MCP). Catalog + comfyops depot pin."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import FastMCP
from fastmcp.server.providers.skills import SkillsDirectoryProvider
from pydantic import BaseModel, Field

from civitai_mcp import outbox
from civitai_mcp._version import __version__
from civitai_mcp.config import get_settings
from civitai_mcp.portmanteau import OPS, civitai_models

log = logging.getLogger(__name__)
cfg = get_settings()

mcp = FastMCP(
    name=cfg.server_name,
    version=__version__,
    instructions=(
        "Civitai marketplace bridge. Search models/LoRAs publicly; "
        "download into comfyops model folders with dry-run + human outbox gate. "
        "Complements comfyops-mcp — do not run Comfy graphs here."
    ),
)

_skills_root = Path(__file__).parent / "skills"
if _skills_root.is_dir():
    mcp.add_provider(SkillsDirectoryProvider(roots=[_skills_root]))


@mcp.prompt()
async def civitai_depot_prompt() -> str:
    """How to find and pin models for comfyops safely."""
    return (
        "Use civitai_models_tool search/get to discover checkpoints and LoRAs.\n"
        "Pin via outbox_enqueue → approve → outbox_publish (download) into CIVITAI_DEPOT_DIR "
        "(defaults to COMFYOPS_MODELS_DIR / COMFYUI_MODELS_DIR).\n"
        "Respect CIVITAI_DRY_RUN=1 until intentional. Need CIVITAI_API_TOKEN for real downloads.\n"
        "Then run workflows in comfyops-mcp — this server only catalogs and fetches weights."
    )


@mcp.tool()
async def civitai_models_tool(
    operation: str,
    query: str = "",
    model_id: int = 0,
    version_id: int = 0,
    types: str = "LORA",
    base_model: str = "",
    username: str = "",
    tag: str = "",
    sort: str = "Most Downloaded",
    limit: int = 20,
    cursor: str = "",
    filename: str = "",
    outbox_id: int = 0,
    reason: str = "",
    dry_run: bool | None = None,
    payload: dict[str, Any] | None = None,
    status_text: str = "",
) -> dict:
    """Portmanteau: search/get/download/pin_comfyops/outbox_* for Civitai → comfyops depot.

    ## Return Format

    ``{success, message?, error?, …}`` from ``civitai_models``.

    ## Examples

    - ``operation=search`` ``query=pony`` ``types=LORA``
    - ``operation=list_local``
    """
    return await civitai_models(
        operation=operation,
        query=query,
        model_id=model_id,
        version_id=version_id,
        types=types,
        base_model=base_model,
        username=username,
        tag=tag,
        sort=sort,
        limit=limit,
        cursor=cursor,
        filename=filename,
        outbox_id=outbox_id,
        reason=reason,
        dry_run=dry_run,
        payload=payload,
        status_text=status_text,
    )


@mcp.tool()
async def civitai_help() -> dict:
    """Help for civitai-mcp."""
    return {
        "server": cfg.server_name,
        "version": __version__,
        "ports": {"backend": cfg.backend_port, "frontend": 11125},
        "dry_run": cfg.dry_run,
        "depot": cfg.depot_dir,
        "tools": ["civitai_models_tool", "civitai_help", "civitai_shutdown"],
        "comfyops": "pin weights here → generate in comfyops-mcp",
        "outbox_flow": "outbox_enqueue → outbox_approve → outbox_publish (download)",
    }


@mcp.tool()
async def civitai_shutdown() -> dict:
    """Signal graceful shutdown (process exit left to host)."""
    return {"success": True, "message": "Shutdown signal acknowledged"}


@mcp.tool(app=True)
async def show_depot_card() -> dict:
    """Prefab card: local depot file count + pending download outbox."""
    from civitai_mcp import client as civ_client

    local = civ_client.list_local(limit=500)
    items = outbox.list_items()
    pending = sum(1 for i in items if i.get("status") == "pending")
    try:
        from prefab_ui.app import PrefabApp
        from prefab_ui.components import Badge, Card, CardContent, Heading, Muted, Text
    except ImportError:
        return {
            "success": True,
            "prefab": False,
            "local_count": local.get("count", 0),
            "pending": pending,
            "depot": cfg.depot_dir,
        }
    app = PrefabApp(title="Civitai Depot")
    with app:
        Heading("Depot", level=2)
        Text(f"{local.get('count', 0)} local files · {pending} pending downloads")
        Muted(cfg.depot_dir)
        Badge("comfyops complement", color="violet")
        for row in [i for i in items if i.get("status") == "pending"][:6]:
            with Card(), CardContent():
                Text((row.get("status_text") or "")[:160])
    return app.output()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    os.makedirs(cfg.data_dir, exist_ok=True)
    Path(cfg.depot_dir).mkdir(parents=True, exist_ok=True)
    outbox._db()
    log.info(
        "civitai-mcp starting port=%s dry_run=%s depot=%s",
        cfg.backend_port,
        cfg.dry_run,
        cfg.depot_dir,
    )
    yield


app = FastAPI(title="civitai-mcp", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:11125",
        "http://localhost:11125",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "server": cfg.server_name,
        "version": __version__,
        "dry_run": cfg.dry_run,
        "instance_configured": cfg.credentials_ready,
        "depot": cfg.depot_dir,
        "ports": {"backend": cfg.backend_port, "frontend": 11125},
    }


@app.get("/api/capabilities")
async def api_capabilities():
    return {
        "success": True,
        "server": cfg.server_name,
        "version": __version__,
        "protocol": "civitai-rest",
        "operations": OPS,
        "comfyops_complement": True,
        "outbox": True,
        "dry_run_default": True,
    }


@app.get("/api/dashboard")
async def api_dashboard():
    from civitai_mcp import client as civ_client

    items = outbox.list_items()
    by_status: dict[str, int] = {}
    for row in items:
        st = str(row.get("status") or "unknown")
        by_status[st] = by_status.get(st, 0) + 1
    local = civ_client.list_local(limit=500)
    return {
        "success": True,
        "pending": by_status.get("pending", 0),
        "approved": by_status.get("approved", 0),
        "published": by_status.get("published", 0),
        "rejected": by_status.get("rejected", 0),
        "total": len(items),
        "local_models": local.get("count", 0),
        "dry_run": cfg.dry_run,
        "instance_configured": cfg.credentials_ready,
        "depot": cfg.depot_dir,
        "recent": items[:8],
    }


@app.get("/api/skills")
async def api_skills():
    root = Path(__file__).parent / "skills"
    skills = []
    if root.is_dir():
        for d in sorted(root.iterdir()):
            skill_md = d / "SKILL.md"
            if d.is_dir() and skill_md.is_file():
                skills.append({"name": d.name, "content": skill_md.read_text(encoding="utf-8")})
    return {"skills": skills, "count": len(skills)}


@app.get("/api/tools")
async def api_tools():
    return {
        "tools": [
            {
                "name": "civitai_models_tool",
                "kind": "portmanteau",
                "operations": OPS,
                "description": "Civitai search/download/pin for comfyops",
            },
            {"name": "civitai_help", "kind": "solo"},
            {"name": "civitai_shutdown", "kind": "solo"},
            {"name": "show_depot_card", "kind": "prefab"},
        ]
    }


@app.get("/api/llm/providers")
async def api_llm_providers():
    import httpx

    providers = []
    for name, port, path in (
        ("Ollama", 11434, "/api/tags"),
        ("LM Studio", 1234, "/v1/models"),
        ("vLLM", 8000, "/v1/models"),
    ):
        detected = False
        models: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=2.0) as http:
                r = await http.get(f"http://127.0.0.1:{port}{path}")
                if r.status_code < 400:
                    detected = True
                    body = r.json()
                    if name == "Ollama":
                        models = [m.get("name", "") for m in body.get("models", [])]
                    else:
                        models = [m.get("id", "") for m in body.get("data", [])]
        except Exception:
            pass
        providers.append(
            {
                "name": name,
                "port": port,
                "detected": detected,
                "models": [m for m in models if m],
            }
        )
    return {"providers": providers}


class ChatBody(BaseModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    model: str = "qwen3:14b"
    provider_port: int = 11434


@app.post("/api/llm/chat")
async def api_llm_chat(body: ChatBody):
    import httpx

    url = f"http://127.0.0.1:{body.provider_port}/api/chat"
    openai_url = f"http://127.0.0.1:{body.provider_port}/v1/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=120.0) as http:
            if body.provider_port == 11434:
                r = await http.post(
                    url,
                    json={
                        "model": body.model,
                        "messages": body.messages,
                        "stream": False,
                    },
                )
                if r.status_code >= 400:
                    return {"success": False, "error": r.text[:300]}
                data = r.json()
                return {
                    "success": True,
                    "content": data.get("message", {}).get("content", ""),
                }
            r = await http.post(openai_url, json={"model": body.model, "messages": body.messages})
            if r.status_code >= 400:
                return {"success": False, "error": r.text[:300]}
            data = r.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"success": True, "content": content}
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


_LOG_RING: list[dict[str, Any]] = []


@app.get("/api/logs")
async def api_logs(limit: int = 100):
    return {"entries": _LOG_RING[-limit:], "count": len(_LOG_RING)}


@app.get("/api/v1/models/search")
async def api_search(q: str = "", types: str = "LORA", limit: int = 20):
    return await civitai_models(operation="search", query=q, types=types, limit=limit)


@app.get("/api/v1/local")
async def api_local():
    return await civitai_models(operation="list_local")


class OutboxBody(BaseModel):
    status_text: str = ""
    version_id: int = 0
    model_id: int = 0
    model_type: str = "LORA"
    filename: str = ""
    repo_id: str = "civitai"
    campaign: str = ""
    source: str = "webapp"
    visibility: str = "public"

    model_config = {"extra": "allow"}


@app.post("/api/v1/outbox")
async def api_outbox_enqueue(body: OutboxBody):
    return outbox.enqueue(body.model_dump())


@app.get("/api/v1/outbox")
async def api_outbox_list(status: str = ""):
    items = outbox.list_items(status)
    return {"items": items, "count": len(items)}


@app.post("/api/v1/outbox/{item_id}/approve")
async def api_outbox_approve(item_id: int):
    return outbox.approve(item_id)


@app.post("/api/v1/outbox/{item_id}/reject")
async def api_outbox_reject(item_id: int, reason: str = ""):
    return outbox.reject(item_id, reason)


@app.post("/api/v1/outbox/{item_id}/publish")
async def api_outbox_publish(item_id: int):
    return await civitai_models(operation="outbox_publish", outbox_id=item_id)


_mcp_asgi = mcp.http_app(path="/")
app.mount("/mcp", _mcp_asgi)


def main() -> None:
    logging.basicConfig(level=getattr(logging, cfg.log_level.upper(), logging.INFO))
    port = int(os.getenv("PORT", cfg.backend_port))
    uvicorn.run(
        "civitai_mcp.server:app",
        host="127.0.0.1",
        port=port,
        log_level=cfg.log_level.lower(),
    )


if __name__ == "__main__":
    main()
