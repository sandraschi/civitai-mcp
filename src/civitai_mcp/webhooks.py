"""Inbound webhook event store + shared-secret verify."""

from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any

from civitai_mcp.config import get_settings


def _db_path() -> Path:
    cfg = get_settings()
    root = Path(cfg.data_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root / "webhooks.sqlite"


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(str(_db_path()))
    c.row_factory = sqlite3.Row
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS webhook_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            event_type TEXT NOT NULL DEFAULT 'generic',
            payload_json TEXT NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    c.commit()
    return c


def webhook_secret() -> str:
    return os.getenv("CIVITAI_WEBHOOK_SECRET", "") or ""


def verify_secret(header_value: str | None) -> bool:
    expected = webhook_secret()
    if not expected:
        # Unset secret: accept only in dry_run / local (dev convenience)
        cfg = get_settings()
        return bool(cfg.dry_run)
    if not header_value:
        return False
    return header_value.strip() == expected


def enqueue_event(source: str, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO webhook_events (source, event_type, payload_json, created_at) VALUES (?,?,?,?)",
            (source, event_type, json.dumps(payload), time.time()),
        )
        c.commit()
        return {
            "success": True,
            "id": cur.lastrowid,
            "source": source,
            "event_type": event_type,
        }


def list_events(limit: int = 50) -> dict[str, Any]:
    with _conn() as c:
        rows = c.execute(
            "SELECT id, source, event_type, payload_json, created_at FROM webhook_events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    items = []
    for r in rows:
        items.append(
            {
                "id": r["id"],
                "source": r["source"],
                "event_type": r["event_type"],
                "payload": json.loads(r["payload_json"]),
                "created_at": r["created_at"],
            }
        )
    return {"success": True, "events": items, "count": len(items)}
