"""应用中心页面与静态资源（AIWorkshop/portal）。"""

from __future__ import annotations

import re
from pathlib import Path

from aiohttp import web

from .paths import (
    portal_index_file,
    portal_open_workflow_file,
    portal_static_dir,
    portal_workflow_editor_file,
)

routes = web.RouteTableDef()

APP_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$")


def _cache_headers(path: Path) -> dict[str, str]:
    ext = path.suffix.lower()
    if ext in (".html", ".js", ".mjs", ".css", ".map"):
        return {"Cache-Control": "no-cache"}
    if ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".woff", ".woff2"):
        return {"Cache-Control": "public, max-age=86400"}
    return {"Cache-Control": "no-cache"}


def _safe_file(root: Path, rel: str) -> Path | None:
    rel = str(rel or "").strip().lstrip("/\\")
    if not rel:
        return None
    target = (root / rel).resolve()
    if not str(target).startswith(str(root.resolve())):
        return None
    return target if target.is_file() else None


@routes.get("/rh")
async def portal_index(_request: web.Request) -> web.Response:
    path = portal_index_file()
    if not path.is_file():
        return web.json_response({"error": f"portal index not found: {path}"}, status=404)
    return web.FileResponse(path, headers=_cache_headers(path))


@routes.get("/rh/app/{app_id}")
async def portal_app(_request: web.Request) -> web.Response:
    path = portal_index_file()
    if not path.is_file():
        return web.Response(status=404)
    return web.FileResponse(path, headers=_cache_headers(path))


@routes.get("/rh/open-workflow/{app_id}")
async def portal_open_workflow(request: web.Request) -> web.Response:
    app_id = str(request.match_info.get("app_id", "")).strip()
    if not APP_ID_PATTERN.match(app_id):
        return web.json_response({"error": "invalid app_id"}, status=400)
    path = portal_open_workflow_file()
    if not path.is_file():
        return web.json_response({"error": "open workflow page not found"}, status=404)
    return web.FileResponse(path, headers=_cache_headers(path))


@routes.get("/rh/editor/{app_id}")
async def portal_workflow_editor(request: web.Request) -> web.Response:
    app_id = str(request.match_info.get("app_id", "")).strip()
    if not APP_ID_PATTERN.match(app_id):
        return web.json_response({"error": "invalid app_id"}, status=400)
    path = portal_workflow_editor_file()
    if not path.is_file():
        return web.json_response({"error": "workflow editor page not found"}, status=404)
    return web.FileResponse(path, headers=_cache_headers(path))


@routes.get("/rh/portal/static/{asset:.*}")
async def portal_static_asset_new(request: web.Request) -> web.Response:
    rel = request.match_info.get("asset", "")
    root = portal_static_dir().resolve()
    target = _safe_file(root, rel)
    if target is None:
        return web.Response(status=404)
    return web.FileResponse(target, headers=_cache_headers(target))


@routes.get("/extensions/ComfyUI-Portal/static/{asset:.*}")
async def portal_static_asset_legacy(request: web.Request) -> web.Response:
    """兼容旧静态资源路径。"""
    return await portal_static_asset_new(request)


def register_portal_routes(app: web.Application) -> None:
    app.add_routes(routes)
