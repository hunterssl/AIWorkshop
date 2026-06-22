"""静态页面：创作工坊 + 无限画布。"""

from __future__ import annotations

from pathlib import Path

from aiohttp import web

from .paths import huobao_canvas_dir, huobao_canvas_index, studio_index_file, studio_ui_dir
from .proxy import COMFYUI_ROOT_QUERY_KEYS, proxy_comfy_request

routes = web.RouteTableDef()


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


@routes.get("/")
async def root_handler(request: web.Request) -> web.StreamResponse:
    if COMFYUI_ROOT_QUERY_KEYS.intersection(request.rel_url.query):
        return await proxy_comfy_request(request)
    raise web.HTTPFound("/rh/studio")


@routes.get("/rh/studio/")
async def studio_slash(_request: web.Request) -> web.Response:
    raise web.HTTPFound("/rh/studio")


@routes.get("/rh/studio")
async def studio_index(_request: web.Request) -> web.Response:
    path = studio_index_file()
    if not path.is_file():
        return web.json_response({"error": f"studio index not found: {path}"}, status=404)
    return web.FileResponse(path, headers=_cache_headers(path))


@routes.get("/rh/studio/chat")
async def studio_chat(_request: web.Request) -> web.Response:
    path = studio_index_file()
    if not path.is_file():
        return web.json_response({"error": f"studio index not found: {path}"}, status=404)
    return web.FileResponse(path, headers=_cache_headers(path))


@routes.get("/rh/studio/{asset:.*}")
async def studio_asset(request: web.Request) -> web.Response:
    rel = request.match_info.get("asset", "")
    root = studio_ui_dir().resolve()
    if not rel:
        path = studio_index_file()
        if path.is_file():
            return web.FileResponse(path, headers=_cache_headers(path))
        return web.Response(status=404)
    target = _safe_file(root, rel)
    if target is None:
        return web.Response(status=404)
    return web.FileResponse(target, headers=_cache_headers(target))


@routes.get("/rh/canvas2")
async def canvas2_root(_request: web.Request) -> web.Response:
    raise web.HTTPFound("/rh/canvas2/")


@routes.get("/rh/canvas2/")
async def canvas2_index(_request: web.Request) -> web.Response:
    path = huobao_canvas_index()
    if not path.is_file():
        return web.json_response({"error": f"canvas index not found: {path}"}, status=404)
    return web.FileResponse(path, headers={"Cache-Control": "no-cache"})


@routes.get("/rh/canvas2/canvas/{canvas_id}")
async def canvas2_spa(_request: web.Request) -> web.Response:
    path = huobao_canvas_index()
    if not path.is_file():
        return web.Response(status=404)
    return web.FileResponse(path, headers={"Cache-Control": "no-cache"})


@routes.get("/rh/canvas2/{asset:.*}")
async def canvas2_asset(request: web.Request) -> web.Response:
    rel = request.match_info.get("asset", "")
    root = huobao_canvas_dir().resolve()
    if not rel:
        path = huobao_canvas_index()
        if path.is_file():
            return web.FileResponse(path, headers={"Cache-Control": "no-cache"})
        return web.Response(status=404)
    target = _safe_file(root, rel)
    if target is None:
        path = huobao_canvas_index()
        if path.is_file():
            return web.FileResponse(path, headers={"Cache-Control": "no-cache"})
        return web.Response(status=404)
    return web.FileResponse(target, headers=_cache_headers(target))


@routes.get("/rh/canvas/projects")
async def legacy_projects(_request: web.Request) -> web.Response:
    raise web.HTTPFound("/rh/canvas2/")


@routes.get("/rh/canvas/project/{project_id}")
async def legacy_project(request: web.Request) -> web.Response:
    pid = str(request.match_info.get("project_id", "")).strip()
    target = f"/rh/canvas2/canvas/{pid}" if pid else "/rh/canvas2/"
    raise web.HTTPFound(target)


def register_static_routes(app: web.Application) -> None:
    app.add_routes(routes)
