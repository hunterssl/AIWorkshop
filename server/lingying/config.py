"""灵影工坊网关配置（独立于 ComfyUI 进程）。"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_FILE = SERVER_DIR / "lingying.server.json"


def _resolve_path(raw: str, base: Path) -> Path:
    text = str(raw or "").strip()
    if not text:
        raise ValueError("empty path")
    path = Path(text).expanduser()
    if not path.is_absolute():
        path = (base / path).resolve()
    else:
        path = path.resolve()
    return path


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    studio_ui_dir: Path
    comfy_worker_url: str
    user_data_dir: Path

    @property
    def comfy_worker_base(self) -> str:
        return self.comfy_worker_url.rstrip("/")


@lru_cache(maxsize=1)
def load_settings(config_path: str | None = None) -> Settings:
    path = Path(config_path) if config_path else DEFAULT_CONFIG_FILE
    data: dict = {}
    if path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))

    host = os.environ.get("RH_LINGYING_HOST", data.get("host", "0.0.0.0")).strip() or "0.0.0.0"
    port = int(os.environ.get("RH_LINGYING_PORT", data.get("port", 8080)))

    studio_raw = os.environ.get("RH_STUDIO_UI_DIR", data.get("studio_ui_dir", ".."))
    studio_ui_dir = _resolve_path(str(studio_raw), SERVER_DIR)

    comfy_worker_url = os.environ.get(
        "RH_COMFY_WORKER_URL",
        data.get("comfy_worker_url", "http://127.0.0.1:8188"),
    ).strip().rstrip("/")

    user_raw = os.environ.get("RH_USER_DATA_DIR", data.get("user_data_dir", "../../user"))
    user_data_dir = _resolve_path(str(user_raw), SERVER_DIR)

    return Settings(
        host=host,
        port=port,
        studio_ui_dir=studio_ui_dir,
        comfy_worker_url=comfy_worker_url,
        user_data_dir=user_data_dir,
    )
