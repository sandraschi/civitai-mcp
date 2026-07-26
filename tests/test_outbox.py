"""Outbox helpers."""

from __future__ import annotations

from civitai_mcp import __version__
from civitai_mcp.outbox import approve, enqueue, get_item, list_items, reject


def test_version():
    assert __version__


def test_enqueue_approve_reject(isolated_data):
    enq = enqueue(
        {
            "status_text": "download version_id=9",
            "version_id": 9,
            "model_type": "Checkpoint",
        }
    )
    oid = enq["id"]
    row = get_item(oid)
    assert row["version_id"] == 9
    assert approve(oid)["status"] == "approved"
    rej = enqueue({"status_text": "nope", "version_id": 1})
    assert reject(rej["id"], "bad")["status"] == "rejected"
    assert len(list_items()) >= 2
