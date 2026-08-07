"""civitai-mcp configuration."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _default_data_dir() -> str:
    return str(Path(__file__).resolve().parents[2] / "data")


def _default_depot() -> str:
    # Prefer comfyops models dir when present
    comfy = os.getenv("COMFYOPS_MODELS_DIR") or os.getenv("COMFYUI_MODELS_DIR")
    if comfy:
        return comfy
    return str(Path(_default_data_dir()) / "models")


def _settings_path(data_dir: str) -> Path:
    return Path(data_dir) / "settings.json"


def _load_settings_file(data_dir: str) -> dict:
    """Runtime-persisted settings (webapp Settings page). Env still wins on reload."""
    try:
        path = _settings_path(data_dir)
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


@dataclass
class Settings:
    server_name: str = "civitai-mcp"
    backend_port: int = 11124
    api_base: str = "https://civitai.com/api/v1"
    api_token: str = ""
    dry_run: bool = True
    require_download_approval: bool = True
    data_dir: str = ""
    depot_dir: str = ""
    log_level: str = "INFO"
    nsfw: bool = False
    comfyops_backend_url: str = "http://127.0.0.1:11087"
    comfyops_frontend_url: str = "http://127.0.0.1:11088"

    def __post_init__(self) -> None:
        self.backend_port = int(os.getenv("CIVITAI_BACKEND_PORT", self.backend_port))
        self.api_base = (os.getenv("CIVITAI_API_BASE", self.api_base) or self.api_base).rstrip("/")
        self.data_dir = os.getenv("CIVITAI_DATA_DIR", "") or _default_data_dir()
        saved = _load_settings_file(self.data_dir)
        self.api_token = str(saved.get("api_token") or "")
        self.dry_run = bool(saved.get("dry_run", True))
        self.require_download_approval = bool(saved.get("require_download_approval", True))
        self.depot_dir = str(saved.get("depot_dir") or _default_depot())
        self.nsfw = bool(saved.get("nsfw", False))
        self.comfyops_backend_url = str(
            saved.get("comfyops_backend_url") or "http://127.0.0.1:11087"
        )
        self.comfyops_frontend_url = str(
            saved.get("comfyops_frontend_url") or "http://127.0.0.1:11088"
        )
        # Env overrides persisted settings (one source of truth: .env wins)
        env_token = os.getenv("CIVITAI_API_TOKEN", "") or os.getenv("CIVITAI_ACCESS_TOKEN", "")
        if env_token:
            self.api_token = env_token
        env_dry = os.getenv("CIVITAI_DRY_RUN", "")
        if env_dry:
            self.dry_run = env_dry not in ("0", "false", "False", "no")
        env_req = os.getenv("CIVITAI_REQUIRE_DOWNLOAD_APPROVAL", "")
        if env_req:
            self.require_download_approval = env_req not in ("0", "false", "False", "no")
        env_depot = os.getenv("CIVITAI_DEPOT_DIR", "")
        if env_depot:
            self.depot_dir = env_depot
        self.log_level = os.getenv("CIVITAI_LOG_LEVEL", self.log_level)
        env_nsfw = os.getenv("CIVITAI_NSFW", "")
        if env_nsfw:
            self.nsfw = env_nsfw in ("1", "true", "True", "yes")
        env_cb = os.getenv("CIVITAI_COMFYOPS_BACKEND_URL", "")
        if env_cb:
            self.comfyops_backend_url = env_cb
        env_cf = os.getenv("CIVITAI_COMFYOPS_FRONTEND_URL", "")
        if env_cf:
            self.comfyops_frontend_url = env_cf

    @property
    def credentials_ready(self) -> bool:
        """Token required for file downloads; search works anonymously."""
        return bool(self.api_token)


def save_settings(**changes) -> dict:
    """Persist runtime settings to data/settings.json. Blank api_token is a no-op."""
    cfg = get_settings()
    saved = _load_settings_file(cfg.data_dir)
    token = changes.get("api_token")
    if token is not None:
        token = str(token).strip()
        if token:
            saved["api_token"] = token
    for key in (
        "dry_run",
        "require_download_approval",
        "depot_dir",
        "nsfw",
        "comfyops_backend_url",
        "comfyops_frontend_url",
    ):
        if key in changes and changes[key] is not None:
            saved[key] = changes[key]
    path = _settings_path(cfg.data_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(saved, indent=2), encoding="utf-8")
    return saved


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
