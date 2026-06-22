"""封面图上传与读取（网关本地存储）。"""

from __future__ import annotations

import uuid
from pathlib import Path

from aiohttp import web

from .paths import portal_covers_dir

COVER_UPLOAD_MAX_BYTES = 6 * 1024 * 1024
COVER_ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"}

routes = web.RouteTableDef()


def _ensure_covers_dir() -> Path:
    path = portal_covers_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


@routes.post("/upload/portal_cover")
@routes.post("/rh/api/publish/cover")
async def upload_cover(request: web.Request) -> web.Response:
    _ensure_covers_dir()
    try:
        reader = await request.multipart()
    except Exception as exc:
        return web.json_response({"error": f"Invalid multipart: {exc}"}, status=400)

    part = await reader.next()
    while part is not None and part.name != "file":
        part = await reader.next()
    if part is None or part.name != "file":
        return web.json_response({"error": "缺少文件字段 file"}, status=400)

    orig = part.filename or ""
    ext = Path(orig).suffix.lower()
    if ext not in COVER_ALLOWED_EXT:
        return web.json_response(
            {"error": f"不支持的图片类型 {ext!r}，请使用：{', '.join(sorted(COVER_ALLOWED_EXT))}"},
            status=400,
        )

    try:
        data = await part.read()
    except Exception as exc:
        return web.json_response({"error": f"读取文件失败: {exc}"}, status=400)

    if len(data) > COVER_UPLOAD_MAX_BYTES:
        return web.json_response(
            {"error": f"文件过大（最大 {COVER_UPLOAD_MAX_BYTES // (1024 * 1024)}MB）"},
            status=400,
        )
    if not data:
        return web.json_response({"error": "空文件"}, status=400)

    new_name = f"{uuid.uuid4().hex}{ext}"
    out_path = (_ensure_covers_dir() / new_name).resolve()
    covers_root = _ensure_covers_dir().resolve()
    if not str(out_path).startswith(str(covers_root)):
        return web.Response(status=500)
    out_path.write_bytes(data)
    rel_url = f"/rh/portal/covers/{new_name}"
    return web.json_response({"ok": True, "url": rel_url, "filename": new_name})


@routes.get(r"/rh/portal/covers/{filename:[^/]+}")
async def serve_portal_cover(request: web.Request) -> web.Response:
    _ensure_covers_dir()
    filename = request.match_info.get("filename", "")
    if not filename or filename in (".", "..") or ".." in filename:
        return web.Response(status=400)
    target = (_ensure_covers_dir() / filename).resolve()
    covers_root = _ensure_covers_dir().resolve()
    if not str(target).startswith(str(covers_root)) or not target.is_file():
        return web.Response(status=404)
    return web.FileResponse(target)


def register_cover_routes(app: web.Application) -> None:
    app.add_routes(routes)
