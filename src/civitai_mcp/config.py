"""civitai-mcp configuration."""

from __future__ import annotations

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

    def __post_init__(self) -> None:
        self.backend_port = int(os.getenv("CIVITAI_BACKEND_PORT", self.backend_port))
        self.api_base = (os.getenv("CIVITAI_API_BASE", self.api_base) or self.api_base).rstrip("/")
        self.api_token = (
            os.getenv("CIVITAI_API_TOKEN", "") or os.getenv("CIVITAI_ACCESS_TOKEN", "") or ""
        )
        dry = os.getenv("CIVITAI_DRY_RUN", "1")
        self.dry_run = dry not in ("0", "false", "False", "no")
        req = os.getenv("CIVITAI_REQUIRE_DOWNLOAD_APPROVAL", "1")
        self.require_download_approval = req not in ("0", "false", "False", "no")
        self.data_dir = os.getenv("CIVITAI_DATA_DIR", "") or _default_data_dir()
        self.depot_dir = os.getenv("CIVITAI_DEPOT_DIR", "") or _default_depot()
        self.log_level = os.getenv("CIVITAI_LOG_LEVEL", self.log_level)
        nsfw = os.getenv("CIVITAI_NSFW", "0")
        self.nsfw = nsfw in ("1", "true", "True", "yes")

    @property
    def credentials_ready(self) -> bool:
        """Token required for file downloads; search works anonymously."""
        return bool(self.api_token)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
