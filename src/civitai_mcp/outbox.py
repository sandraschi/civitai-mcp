"""SQLite outbox for fleet-PR drafts — pending → approved → published|rejected."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import UTC, datetime
from typing import Any

from civitai_mcp.config import get_settings

_DB: sqlite3.Connection | None = None


def _db() -> sqlite3.Connection:
    global _DB
    if _DB is None:
        cfg = get_settings()
        os.makedirs(cfg.data_dir, exist_ok=True)
        path = os.path.join(cfg.data_dir, "outbox.sqlite3")
        _DB = sqlite3.connect(path, check_same_thread=False)
        _DB.row_factory = sqlite3.Row
        _DB.execute("PRAGMA journal_mode=WAL")
        _DB.executescript(
            """
            CREATE TABLE IF NOT EXISTS outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL DEFAULT 'pending',
                repo_id TEXT NOT NULL DEFAULT '',
                campaign TEXT NOT NULL DEFAULT '',
                status_text TEXT NOT NULL DEFAULT '',
                visibility TEXT NOT NULL DEFAULT 'public',
                payload_json TEXT NOT NULL DEFAULT '{}',
                idempotency_key TEXT NOT NULL DEFAULT '',
                reject_reason TEXT NOT NULL DEFAULT '',
                published_status_id TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
            """
        )
        _DB.commit()
    return _DB


def enqueue(payload: dict[str, Any]) -> dict[str, Any]:
    db = _db()
    now = datetime.now(UTC).isoformat()
    text = payload.get("status_text") or payload.get("text") or ""
    cur = db.execute(
        "INSERT INTO outbox (status, repo_id, campaign, status_text, visibility, "
        "payload_json, idempotency_key, created_at, updated_at) "
        "VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            str(payload.get("repo_id", "")),
            str(payload.get("campaign", "")),
            text,
            str(payload.get("visibility", "public")),
            json.dumps(payload),
            str(payload.get("idempotency_key", "")),
            now,
            now,
        ),
    )
    db.commit()
    return {
        "success": True,
        "id": cur.lastrowid,
        "outbox_id": cur.lastrowid,
        "status": "pending",
        "message": "queued — human approve required before publish",
    }


def list_items(status: str = "") -> list[dict]:
    db = _db()
    if status:
        rows = db.execute(
            "SELECT * FROM outbox WHERE status=? ORDER BY created_at DESC", (status,)
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM outbox ORDER BY created_at DESC LIMIT 100").fetchall()
    return [dict(r) for r in rows]


def get_item(item_id: int) -> dict | None:
    db = _db()
    row = db.execute("SELECT * FROM outbox WHERE id=?", (item_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    try:
        payload = json.loads(d.get("payload_json") or "{}")
        if isinstance(payload, dict):
            for k, v in payload.items():
                if k not in d or d.get(k) in ("", None, 0):
                    d[k] = v
    except json.JSONDecodeError:
        pass
    return d


def approve(item_id: int) -> dict[str, Any]:
    db = _db()
    row = get_item(item_id)
    if not row:
        return {"success": False, "error": f"outbox {item_id} not found"}
    if row["status"] not in ("pending", "rejected"):
        return {"success": False, "error": f"cannot approve from status={row['status']}"}
    now = datetime.now(UTC).isoformat()
    db.execute(
        "UPDATE outbox SET status='approved', updated_at=? WHERE id=?",
        (now, item_id),
    )
    db.commit()
    return {"success": True, "id": item_id, "status": "approved"}


def reject(item_id: int, reason: str = "") -> dict[str, Any]:
    db = _db()
    row = get_item(item_id)
    if not row:
        return {"success": False, "error": f"outbox {item_id} not found"}
    now = datetime.now(UTC).isoformat()
    db.execute(
        "UPDATE outbox SET status='rejected', reject_reason=?, updated_at=? WHERE id=?",
        (reason, now, item_id),
    )
    db.commit()
    return {"success": True, "id": item_id, "status": "rejected"}


def mark_published(item_id: int, status_id: str) -> None:
    db = _db()
    now = datetime.now(UTC).isoformat()
    db.execute(
        "UPDATE outbox SET status='published', published_status_id=?, updated_at=? WHERE id=?",
        (status_id, now, item_id),
    )
    db.commit()
