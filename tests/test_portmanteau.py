"""Portmanteau outbox download lifecycle."""

from __future__ import annotations

import pytest

from civitai_mcp.portmanteau import civitai_models


@pytest.mark.asyncio
async def test_outbox_download_lifecycle(isolated_data, monkeypatch):
    from civitai_mcp import client

    async def fake_version(version_id: int):
        return {
            "success": True,
            "version": {
                "id": version_id,
                "files": [
                    {
                        "name": "x.safetensors",
                        "primary": True,
                        "sizeKB": 1,
                        "downloadUrl": "https://example.invalid/x",
                    }
                ],
                "downloadUrl": "https://example.invalid/x",
            },
        }

    monkeypatch.setattr(client, "get_model_version", fake_version)

    enq = await civitai_models(
        operation="outbox_enqueue",
        version_id=42,
        types="LORA",
        status_text="pin LoRA version_id=42",
    )
    assert enq["success"] is True
    oid = enq["id"]

    listed = await civitai_models(operation="outbox_list")
    assert any(i["id"] == oid for i in listed["items"])

    assert (await civitai_models(operation="outbox_publish", outbox_id=oid))["success"] is False

    appr = await civitai_models(operation="outbox_approve", outbox_id=oid)
    assert appr["status"] == "approved"

    pub = await civitai_models(operation="outbox_publish", outbox_id=oid, dry_run=True)
    assert pub["success"] is True
    assert pub["dry_run"] is True


@pytest.mark.asyncio
async def test_live_download_blocked_without_outbox(isolated_data):
    r = await civitai_models(operation="download", version_id=1, types="LORA", dry_run=False)
    assert r["success"] is False
    assert "outbox" in r["error"].lower() or "blocked" in r["error"].lower()


@pytest.mark.asyncio
async def test_unknown_op(isolated_data):
    bad = await civitai_models(operation="dance")
    assert bad["success"] is False
