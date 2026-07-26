"""Client dry-run / local depot."""

from __future__ import annotations

import pytest

from civitai_mcp import client


@pytest.mark.asyncio
async def test_download_dry_run(isolated_data, monkeypatch):
    async def fake_version(version_id: int):
        return {
            "success": True,
            "version": {
                "id": version_id,
                "downloadUrl": "https://civitai.com/api/download/models/1",
                "files": [
                    {
                        "name": "test.safetensors",
                        "primary": True,
                        "sizeKB": 10,
                        "downloadUrl": "https://civitai.com/api/download/models/1",
                    }
                ],
            },
        }

    monkeypatch.setattr(client, "get_model_version", fake_version)
    r = await client.download_version(1, model_type="LORA", dry_run=True)
    assert r["success"] is True
    assert r["dry_run"] is True
    assert "loras" in r["dest"].replace("\\", "/")


def test_list_local_empty(isolated_data):
    r = client.list_local()
    assert r["success"] is True
    assert r["items"] == []


def test_folder_for_type():
    assert client.folder_for_type("Checkpoint") == "checkpoints"
    assert client.folder_for_type("LORA") == "loras"
