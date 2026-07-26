"""Civitai REST client — search is public; downloads need API token; dry_run short-circuits writes."""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import httpx

from civitai_mcp.config import get_settings

log = logging.getLogger(__name__)

TYPE_FOLDER = {
    "Checkpoint": "checkpoints",
    "LORA": "loras",
    "LoCon": "loras",
    "DoRA": "loras",
    "TextualInversion": "embeddings",
    "VAE": "vae",
    "ControlNet": "controlnet",
    "Upscaler": "upscale_models",
    "MotionModule": "motion_modules",
    "Wildcards": "wildcards",
    "Workflows": "workflows",
}


def _headers() -> dict[str, str]:
    cfg = get_settings()
    h = {"Content-Type": "application/json"}
    if cfg.api_token:
        h["Authorization"] = f"Bearer {cfg.api_token}"
    return h


def _safe_name(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name).strip("_")[:180] or "model"


def folder_for_type(model_type: str) -> str:
    return TYPE_FOLDER.get(model_type, "misc")


async def search_models(
    query: str = "",
    *,
    types: str = "",
    base_model: str = "",
    username: str = "",
    tag: str = "",
    sort: str = "Most Downloaded",
    limit: int = 20,
    cursor: str = "",
) -> dict[str, Any]:
    cfg = get_settings()
    params: dict[str, Any] = {
        "limit": max(1, min(limit, 100)),
        "sort": sort or "Most Downloaded",
        "nsfw": "true" if cfg.nsfw else "false",
    }
    if query:
        params["query"] = query
    if types:
        params["types"] = types
    if base_model:
        params["baseModels"] = base_model
    if username:
        params["username"] = username
    if tag:
        params["tag"] = tag
    if cursor:
        params["cursor"] = cursor
    try:
        async with httpx.AsyncClient(timeout=45.0) as http:
            resp = await http.get(f"{cfg.api_base}/models", headers=_headers(), params=params)
            if resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"HTTP {resp.status_code}",
                    "detail": resp.text[:300],
                }
            data = resp.json()
            items = []
            for m in data.get("items") or []:
                items.append(_summarize_model(m))
            meta = data.get("metadata") or {}
            return {
                "success": True,
                "items": items,
                "count": len(items),
                "next_cursor": meta.get("nextCursor"),
                "message": f"{len(items)} models",
            }
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


async def get_model(model_id: int) -> dict[str, Any]:
    if not model_id:
        return {"success": False, "error": "model_id required"}
    cfg = get_settings()
    try:
        async with httpx.AsyncClient(timeout=45.0) as http:
            resp = await http.get(f"{cfg.api_base}/models/{model_id}", headers=_headers())
            if resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"HTTP {resp.status_code}",
                    "detail": resp.text[:300],
                }
            raw = resp.json()
            return {
                "success": True,
                "model": _summarize_model(raw, full=True),
                "raw_keys": list(raw.keys()),
            }
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


def _summarize_model(m: dict[str, Any], *, full: bool = False) -> dict[str, Any]:
    versions = []
    for v in m.get("modelVersions") or []:
        files = []
        for f in v.get("files") or []:
            files.append(
                {
                    "id": f.get("id"),
                    "name": f.get("name"),
                    "sizeKB": f.get("sizeKB"),
                    "primary": f.get("primary"),
                    "downloadUrl": f.get("downloadUrl") or v.get("downloadUrl"),
                    "hashes": f.get("hashes"),
                }
            )
        versions.append(
            {
                "id": v.get("id"),
                "name": v.get("name"),
                "baseModel": v.get("baseModel"),
                "downloadUrl": v.get("downloadUrl"),
                "files": files if full else files[:3],
                "stats": v.get("stats"),
            }
        )
    out: dict[str, Any] = {
        "id": m.get("id"),
        "name": m.get("name"),
        "type": m.get("type"),
        "nsfw": m.get("nsfw"),
        "creator": (m.get("creator") or {}).get("username"),
        "tags": m.get("tags") or [],
        "stats": m.get("stats"),
        "url": f"https://civitai.com/models/{m.get('id')}",
        "modelVersions": versions if full else versions[:3],
        "version_count": len(m.get("modelVersions") or []),
    }
    if full:
        out["description"] = (m.get("description") or "")[:2000]
    return out


async def get_model_version(version_id: int) -> dict[str, Any]:
    if not version_id:
        return {"success": False, "error": "version_id required"}
    cfg = get_settings()
    try:
        async with httpx.AsyncClient(timeout=45.0) as http:
            resp = await http.get(f"{cfg.api_base}/model-versions/{version_id}", headers=_headers())
            if resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"HTTP {resp.status_code}",
                    "detail": resp.text[:300],
                }
            return {"success": True, "version": resp.json()}
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


async def search_creators(query: str = "", *, limit: int = 20) -> dict[str, Any]:
    cfg = get_settings()
    params: dict[str, Any] = {"limit": max(1, min(limit, 200))}
    if query:
        params["query"] = query
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.get(f"{cfg.api_base}/creators", headers=_headers(), params=params)
            if resp.status_code >= 400:
                return {"success": False, "error": f"HTTP {resp.status_code}"}
            data = resp.json()
            return {
                "success": True,
                "items": data.get("items") or [],
                "count": len(data.get("items") or []),
            }
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


async def search_tags(query: str = "", *, limit: int = 20) -> dict[str, Any]:
    cfg = get_settings()
    params: dict[str, Any] = {"limit": max(1, min(limit, 200))}
    if query:
        params["query"] = query
    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            resp = await http.get(f"{cfg.api_base}/tags", headers=_headers(), params=params)
            if resp.status_code >= 400:
                return {"success": False, "error": f"HTTP {resp.status_code}"}
            data = resp.json()
            return {
                "success": True,
                "items": data.get("items") or [],
                "count": len(data.get("items") or []),
            }
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


async def download_version(
    version_id: int,
    *,
    model_type: str = "LORA",
    filename: str = "",
    dry_run: bool | None = None,
    for_comfyops: bool = True,
) -> dict[str, Any]:
    """Download a model version file into the depot (comfyops models layout)."""
    cfg = get_settings()
    use_dry = cfg.dry_run if dry_run is None else dry_run
    ver = await get_model_version(version_id)
    if not ver.get("success"):
        return ver
    version = ver["version"]
    files = version.get("files") or []
    primary = next((f for f in files if f.get("primary")), files[0] if files else None)
    if not primary:
        return {"success": False, "error": "no files on this version"}
    url = primary.get("downloadUrl") or version.get("downloadUrl")
    if not url:
        return {"success": False, "error": "no downloadUrl"}
    fname = filename or primary.get("name") or f"model-{version_id}.safetensors"
    fname = _safe_name(fname)
    sub = folder_for_type(model_type or version.get("model", {}).get("type") or "LORA")
    dest_dir = Path(cfg.depot_dir) / sub
    dest = dest_dir / fname

    if use_dry:
        return {
            "success": True,
            "dry_run": True,
            "message": "dry_run — not downloaded",
            "version_id": version_id,
            "dest": str(dest),
            "sizeKB": primary.get("sizeKB"),
            "url": url,
            "comfyops_folder": sub,
            "for_comfyops": for_comfyops,
        }

    if not cfg.api_token:
        return {
            "success": False,
            "error": "CIVITAI_API_TOKEN required for downloads (create at civitai.com/user/account)",
        }

    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as http:
            async with http.stream(
                "GET",
                url,
                headers={"Authorization": f"Bearer {cfg.api_token}"},
            ) as resp:
                if resp.status_code >= 400:
                    body = (await resp.aread())[:300]
                    return {
                        "success": False,
                        "error": f"download HTTP {resp.status_code}",
                        "detail": body.decode("utf-8", errors="replace"),
                    }
                with dest.open("wb") as fh:
                    async for chunk in resp.aiter_bytes():
                        fh.write(chunk)
        return {
            "success": True,
            "dry_run": False,
            "path": str(dest),
            "bytes": dest.stat().st_size,
            "comfyops_folder": sub,
            "message": f"saved to {dest} — point ComfyUI/comfyops models at {cfg.depot_dir}",
        }
    except OSError as exc:
        return {"success": False, "error": str(exc)}
    except httpx.HTTPError as exc:
        return {"success": False, "error": str(exc)}


def list_local(*, limit: int = 100) -> dict[str, Any]:
    cfg = get_settings()
    root = Path(cfg.depot_dir)
    if not root.is_dir():
        return {
            "success": True,
            "items": [],
            "depot": str(root),
            "message": "depot empty or missing",
        }
    items = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and path.suffix.lower() in {
            ".safetensors",
            ".ckpt",
            ".pt",
            ".pth",
            ".bin",
            ".json",
        }:
            items.append(
                {
                    "path": str(path),
                    "rel": str(path.relative_to(root)),
                    "size": path.stat().st_size,
                }
            )
            if len(items) >= limit:
                break
    return {"success": True, "items": items, "count": len(items), "depot": str(root)}
