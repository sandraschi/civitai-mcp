"""Shared fixtures — declared doubles (temp depot, dry_run, no token)."""

from __future__ import annotations

import pytest


@pytest.fixture()
def isolated_data(tmp_path, monkeypatch):
    monkeypatch.setenv("CIVITAI_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("CIVITAI_DEPOT_DIR", str(tmp_path / "models"))
    monkeypatch.setenv("CIVITAI_DRY_RUN", "1")
    monkeypatch.setenv("CIVITAI_REQUIRE_DOWNLOAD_APPROVAL", "1")
    monkeypatch.delenv("CIVITAI_API_TOKEN", raising=False)
    monkeypatch.delenv("CIVITAI_ACCESS_TOKEN", raising=False)

    from civitai_mcp import config, outbox

    config.get_settings.cache_clear()
    outbox._DB = None
    yield tmp_path
    outbox._DB = None
    config.get_settings.cache_clear()


@pytest.fixture()
def client(isolated_data):
    from fastapi.testclient import TestClient

    from civitai_mcp.server import app

    with TestClient(app) as c:
        yield c
