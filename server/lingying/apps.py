"""应用模板列表（读本地 JSON，不依赖 ComfyUI 进程）。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from aiohttp import web

from .paths import portal_apps_dir, portal_workflows_dir

routes = web.RouteTableDef()

STUDIO_MODE_KEYS = frozenset({"t2i", "t2v", "i2i", "i2v"})

_APPS_SUMMARY_CACHE: dict[str, Any] = {"stamp": None, "apps": []}


def _apps_dir_stamp() -> tuple[int, int, int]:
    count = 0
    newest_mtime_ns = 0
    total_size = 0
    for path in portal_apps_dir().glob("*.json"):
        try:
            stat = path.stat()
        except OSError:
            continue
        count += 1
        total_size += int(stat.st_size)
        newest_mtime_ns = max(newest_mtime_ns, int(stat.st_mtime_ns))
    return (count, total_size, newest_mtime_ns)


def _load_manifest(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("App manifest must be a JSON object")
    return raw


def _manifest_summary(manifest: dict[str, Any], filename_stem: str) -> dict[str, Any]:
    raw_modes = manifest.get("studio_modes")
    studio_modes: list[str] = []
    if isinstance(raw_modes, list):
        for mode in raw_modes:
            if isinstance(mode, str) and mode in STUDIO_MODE_KEYS:
                studio_modes.append(mode)
    return {
        "id": manifest.get("id") or filename_stem,
        "name": manifest.get("name") or filename_stem,
        "description": manifest.get("description", ""),
        "cover_url": manifest.get("cover_url", ""),
        "tags": manifest.get("tags", []),
        "version": manifest.get("version", "1.0.0"),
        "updated_at": manifest.get("updated_at", ""),
        "param_count": len(manifest.get("params", []) or []),
        "has_workflow_json": isinstance(manifest.get("workflow_json"), dict),
        "publish_source": (manifest.get("publish_meta") or {}).get("source", "legacy"),
        "studio_modes": studio_modes,
    }


def _manifest_light_detail(manifest: dict[str, Any], filename_stem: str) -> dict[str, Any]:
    data = dict(manifest)
    data.pop("workflow_json", None)
    data.pop("prompt_template", None)
    data.pop("validation_snapshot", None)
    data["id"] = data.get("id") or filename_stem
    data["name"] = data.get("name") or filename_stem
    data["param_count"] = len(data.get("params", []) or [])
    return data


def _workflow_file_path(app_id: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", app_id.strip())
    return portal_workflows_dir() / f"{safe}.workflow.json"


def _save_workflow_file(app_id: str, workflow_json: Any) -> None:
    if not isinstance(workflow_json, dict):
        return
    nodes = workflow_json.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        return
    path = _workflow_file_path(app_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(workflow_json, ensure_ascii=False, indent=2), encoding="utf-8")


def _get_apps_summary_cached() -> list[dict[str, Any]]:
    portal_apps_dir().mkdir(parents=True, exist_ok=True)
    stamp = _apps_dir_stamp()
    if _APPS_SUMMARY_CACHE.get("stamp") == stamp:
        return list(_APPS_SUMMARY_CACHE.get("apps") or [])

    apps: list[dict[str, Any]] = []
    for path in sorted(portal_apps_dir().glob("*.json")):
        try:
            manifest = _load_manifest(path)
            apps.append(_manifest_summary(manifest, path.stem))
        except Exception as exc:
            apps.append(
                {
                    "id": path.stem,
                    "name": path.stem,
                    "description": f"Invalid manifest: {exc}",
                    "cover_url": "",
                    "tags": ["invalid"],
                    "version": "unknown",
                    "updated_at": "",
                }
            )

    _APPS_SUMMARY_CACHE["stamp"] = stamp
    _APPS_SUMMARY_CACHE["apps"] = apps
    return list(apps)


@routes.get("/rh/api/apps")
async def get_apps(request: web.Request) -> web.Response:
    if request.rel_url.query.get("refresh") in {"1", "true", "yes"}:
        _APPS_SUMMARY_CACHE["stamp"] = None
    return web.json_response({"apps": _get_apps_summary_cached()})


@routes.get("/rh/api/apps/{app_id}")
async def get_app(request: web.Request) -> web.Response:
    app_id = request.match_info.get("app_id", "")
    path = portal_apps_dir() / f"{app_id}.json"
    if not path.is_file():
        return web.json_response({"error": "App not found"}, status=404)
    lite = request.rel_url.query.get("lite") in {"1", "true", "yes"}
    try:
        manifest = _load_manifest(path)
        if lite:
            return web.json_response(_manifest_light_detail(manifest, path.stem))
        return web.json_response(manifest)
    except Exception as exc:
        return web.json_response({"error": f"Invalid app manifest: {exc}"}, status=500)


@routes.get("/rh/api/apps/{app_id}/workflow-file")
async def get_app_workflow_file(request: web.Request) -> web.Response:
    app_id = request.match_info.get("app_id", "")
    path = portal_apps_dir() / f"{app_id}.json"
    if not path.is_file():
        return web.json_response({"error": "App not found"}, status=404)
    try:
        manifest = _load_manifest(path)
    except Exception as exc:
        return web.json_response({"error": f"Invalid app manifest: {exc}"}, status=500)

    workflow_path = _workflow_file_path(app_id)
    if not workflow_path.is_file():
        _save_workflow_file(app_id, manifest.get("workflow_json"))
    if not workflow_path.is_file():
        return web.json_response({"error": "workflow_json missing"}, status=404)

    return web.FileResponse(
        workflow_path,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-cache",
            "Content-Disposition": f'inline; filename="{workflow_path.name}"',
        },
    )


def register_apps_routes(app: web.Application) -> None:
    app.add_routes(routes)
