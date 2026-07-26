"""civitai_models portmanteau — catalog + depot pin for comfyops."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import Field

from civitai_mcp import client, outbox
from civitai_mcp.config import get_settings

OPS = [
    "search",
    "get",
    "version_get",
    "creators",
    "tags",
    "download",
    "pin_comfyops",
    "list_local",
    "outbox_list",
    "outbox_enqueue",
    "outbox_approve",
    "outbox_publish",
    "outbox_reject",
]


async def civitai_models(
    operation: Annotated[str, Field(description="|".join(OPS))],
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
) -> dict[str, Any]:
    """Civitai marketplace search + download into comfyops model depot.

    Complements comfyops-mcp: discover/pin weights here; run graphs there.
    Large downloads: outbox_enqueue → approve → outbox_publish (download).

    ## Return Format

    Dialogic ``{success, message?, error?, …}``.

    ## Examples

    - ``operation=search``, ``query=illustrious``, ``types=LORA``
    - ``operation=get``, ``model_id=827184``
    - ``operation=pin_comfyops``, ``version_id=2514310``, ``types=Checkpoint``
    """
    op = operation.strip().lower()
    cfg = get_settings()

    if op == "search":
        return await client.search_models(
            query,
            types=types,
            base_model=base_model,
            username=username,
            tag=tag,
            sort=sort,
            limit=limit,
            cursor=cursor,
        )

    if op == "get":
        return await client.get_model(model_id)

    if op == "version_get":
        return await client.get_model_version(version_id)

    if op == "creators":
        return await client.search_creators(query, limit=limit)

    if op == "tags":
        return await client.search_tags(query or tag, limit=limit)

    if op == "list_local":
        return client.list_local(limit=limit)

    if op in ("download", "pin_comfyops"):
        if (
            cfg.require_download_approval
            and not outbox_id
            and not (dry_run is True or (dry_run is None and cfg.dry_run))
        ):
            # Allow dry_run without outbox; live needs outbox or approval off
            if dry_run is False or (dry_run is None and not cfg.dry_run):
                return {
                    "success": False,
                    "error": (
                        "live download blocked — outbox_enqueue then approve + outbox_publish "
                        "(or set CIVITAI_REQUIRE_DOWNLOAD_APPROVAL=0)"
                    ),
                }
        if outbox_id:
            return await civitai_models(
                operation="outbox_publish", outbox_id=outbox_id, dry_run=dry_run
            )
        return await client.download_version(
            version_id,
            model_type=types or "LORA",
            filename=filename,
            dry_run=dry_run,
            for_comfyops=True,
        )

    if op == "outbox_list":
        return {"success": True, "items": outbox.list_items()}

    if op == "outbox_enqueue":
        if not payload:
            payload = {
                "status_text": status_text
                or f"download version_id={version_id} type={types} {query}".strip(),
                "version_id": version_id,
                "model_id": model_id,
                "model_type": types,
                "filename": filename,
                "source": "civitai_models",
                "visibility": "public",
            }
        return outbox.enqueue(payload)

    if op == "outbox_approve":
        if not outbox_id:
            return {"success": False, "error": "outbox_id required"}
        return outbox.approve(outbox_id)

    if op == "outbox_reject":
        if not outbox_id:
            return {"success": False, "error": "outbox_id required"}
        return outbox.reject(outbox_id, reason)

    if op == "outbox_publish":
        if not outbox_id:
            return {"success": False, "error": "outbox_id required"}
        row = outbox.get_item(outbox_id)
        if not row:
            return {"success": False, "error": "not found"}
        if row["status"] != "approved":
            return {"success": False, "error": "must be approved before download"}
        # payload fields stored in outbox row extras when available
        vid = int(row.get("version_id") or 0)
        mtype = row.get("model_type") or row.get("visibility") or "LORA"
        # status_text may embed version_id=N
        if not vid and "version_id=" in (row.get("status_text") or ""):
            try:
                part = (row["status_text"].split("version_id=")[1]).split()[0]
                vid = int(part)
            except (IndexError, ValueError):
                vid = 0
        if not vid:
            return {"success": False, "error": "outbox row missing version_id"}
        result = await client.download_version(
            vid,
            model_type=str(mtype),
            filename=row.get("filename") or "",
            dry_run=dry_run,
            for_comfyops=True,
        )
        if result.get("success") and not result.get("dry_run"):
            outbox.mark_published(outbox_id, result.get("path") or str(vid))
        elif result.get("success") and result.get("dry_run"):
            result["message"] = (
                "dry_run download OK — set CIVITAI_DRY_RUN=0 and API token to save weights"
            )
        return result

    return {
        "success": False,
        "error": f"unknown operation {operation!r}",
        "operations": OPS,
    }
