"""AIWorkshop 路径（与 ComfyUI-Portal studio_paths 对齐，但不依赖 ComfyUI）。"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import load_settings

_CONFIG_NAMES = ("studio.config.json", "rh_studio.config.json")


@lru_cache(maxsize=1)
def studio_root() -> Path:
    return load_settings().studio_ui_dir


@lru_cache(maxsize=1)
def _load_studio_config() -> dict[str, Any]:
    root = studio_root()
    for name in _CONFIG_NAMES:
        for base in (root.parent / "custom_nodes" / "ComfyUI-Portal", root, root.parent):
            path = base / name
            if path.is_file():
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    if isinstance(data, dict):
                        return data
                except Exception:
                    pass
    return {}


def portal_data_dir() -> Path:
    return studio_root() / "data"


def portal_covers_dir() -> Path:
    return portal_data_dir() / "covers"


def portal_apps_dir() -> Path:
    return portal_data_dir() / "apps"


def portal_workflows_dir() -> Path:
    return portal_apps_dir() / "workflows"


def studio_ui_dir() -> Path:
    return studio_root() / "studio"


def studio_index_file() -> Path:
    return studio_ui_dir() / "index.html"


def huobao_canvas_dir() -> Path:
    return studio_root() / "canvas" / "dist"


def huobao_canvas_index() -> Path:
    return huobao_canvas_dir() / "index.html"


def portal_ui_dir() -> Path:
    return studio_root() / "portal"


def portal_index_file() -> Path:
    return portal_ui_dir() / "index.html"


def portal_open_workflow_file() -> Path:
    return portal_ui_dir() / "open_workflow.html"


def portal_workflow_editor_file() -> Path:
    return portal_ui_dir() / "workflow_editor_iframe.html"


def portal_static_dir() -> Path:
    return portal_ui_dir() / "static"
