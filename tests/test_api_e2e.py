"""API e2e."""

from __future__ import annotations


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["server"] == "civitai-mcp"
    assert body["dry_run"] is True
    assert body["instance_configured"] is False


def test_capabilities(client):
    r = client.get("/api/capabilities")
    assert r.status_code == 200
    body = r.json()
    assert body["comfyops_complement"] is True
    assert "search" in body["operations"]


def test_dashboard(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_tools(client):
    names = [t["name"] for t in client.get("/api/tools").json()["tools"]]
    assert "civitai_models_tool" in names


def test_outbox_api(client):
    enq = client.post(
        "/api/v1/outbox",
        json={
            "status_text": "pin version_id=7",
            "version_id": 7,
            "model_type": "LORA",
        },
    )
    assert enq.json()["success"] is True
    oid = enq.json()["id"]
    assert client.post(f"/api/v1/outbox/{oid}/approve").json()["status"] == "approved"


def test_skills_logs_llm(client):
    assert "skills" in client.get("/api/skills").json()
    assert "entries" in client.get("/api/logs").json()
    assert "providers" in client.get("/api/llm/providers").json()
