"""反向代理到 ComfyUI 算力节点。"""

from __future__ import annotations

import asyncio
import logging
import urllib.parse

import aiohttp
from aiohttp import web, WSMsgType

from .auth_routes import _resolve_studio_user_from_request
from .config import load_settings

logger = logging.getLogger("lingying.proxy")

_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}

# 浏览器 → 网关(8080) 的 Origin/Host 不能原样带给 ComfyUI(8188)，否则会触发 CSRF 403。
_STRIP_TO_WORKER = {
    "origin",
    "referer",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
}

_PROXY_PREFIXES: tuple[str, ...] = (
    "/prompt",
    "/queue",
    "/history",
    "/view",
    "/upload",
    "/userdata",
    "/v2/",
    "/settings",
    "/system_stats",
    "/object_info",
    "/internal/",
    "/api/",
    "/ws",
    "/rh/api/",
)

_LOCAL_RH_API_PREFIXES: tuple[str, ...] = (
    "/rh/api/studio/auth/",
    "/rh/api/health",
    "/rh/api/comfy/status",
    "/rh/api/canvas2/config",
    "/rh/api/publish/cover",
)

# ComfyUI 原生画布入口（与 ComfyUI-Portal routes.py 保持一致）
COMFYUI_ROOT_QUERY_KEYS = frozenset(
    {
        "rh_iframe_editor",
        "rh_portal_workflow_file_app",
        "rh_portal_open_workflow",
        "rh_comfy_ui",
    }
)

# ComfyUI 前端静态资源（iframe 编辑工作流时需要）
_COMFY_UI_PREFIXES: tuple[str, ...] = (
    "/scripts",
    "/assets",
    "/docs",
    "/lib",
    "/templates",
    "/extensions",
    "/embeddings",
    "/models",
)

_ROOT_ASSET_SUFFIXES = (
    ".ico",
    ".json",
    ".webp",
    ".png",
    ".svg",
    ".woff",
    ".woff2",
    ".wasm",
    ".map",
    ".css",
    ".js",
)


def _is_comfy_root_asset(path: str) -> bool:
    if not path or path == "/":
        return False
    name = path.rsplit("/", 1)[-1]
    return bool(name) and any(name.endswith(suffix) for suffix in _ROOT_ASSET_SUFFIXES)


def _is_local_rh_api(path: str, method: str) -> bool:
    method_upper = (method or "").upper()
    if any(path.startswith(p) for p in _LOCAL_RH_API_PREFIXES):
        return True

    if path == "/rh/api/apps":
        return method_upper == "GET"

    if path.startswith("/rh/api/apps/"):
        tail = path[len("/rh/api/apps/") :]
        if tail and "/" not in tail:
            return method_upper == "GET"
        if tail.count("/") == 1 and tail.endswith("/workflow-file"):
            return method_upper in {"GET", "PUT"}

    return False


def _should_proxy(path: str, method: str) -> bool:
    if _is_local_rh_api(path, method):
        return False
    if any(path.startswith(p) for p in _COMFY_UI_PREFIXES):
        return True
    if _is_comfy_root_asset(path):
        return True
    return any(path.startswith(p) for p in _PROXY_PREFIXES)


def _worker_netloc() -> str:
    parsed = urllib.parse.urlparse(load_settings().comfy_worker_url)
    if parsed.netloc:
        return parsed.netloc
    return parsed.path or "127.0.0.1:8188"


def _forward_headers(request: web.Request, comfy_user: str | None) -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in _HOP_BY_HOP or lower in _STRIP_TO_WORKER:
            continue
        headers[key] = value
    headers["Host"] = _worker_netloc()
    if comfy_user and "comfy-user" not in {k.lower() for k in headers}:
        headers["Comfy-User"] = comfy_user
    return headers


def _worker_url(path_qs: str) -> str:
    settings = load_settings()
    if not path_qs.startswith("/"):
        path_qs = "/" + path_qs
    return f"{settings.comfy_worker_base}{path_qs}"


def _worker_ws_url(path_qs: str) -> str:
    settings = load_settings()
    base = settings.comfy_worker_base
    if base.startswith("https://"):
        ws_base = "wss://" + base[len("https://") :]
    elif base.startswith("http://"):
        ws_base = "ws://" + base[len("http://") :]
    else:
        ws_base = "ws://" + base
    if not path_qs.startswith("/"):
        path_qs = "/" + path_qs
    return f"{ws_base}{path_qs}"


async def _proxy_http(request: web.Request, *, force: bool = False) -> web.Response:
    path = request.path
    if not force and not _should_proxy(path, request.method):
        logger.warning(
            "gateway local 404: method=%s path=%s query=%s",
            request.method,
            request.path,
            request.query_string,
        )
        return web.json_response({"error": "not found"}, status=404)

    comfy_user = _resolve_studio_user_from_request(request)
    target = _worker_url(request.path_qs)
    headers = _forward_headers(request, comfy_user if comfy_user else None)
    timeout = aiohttp.ClientTimeout(total=None, sock_connect=30, sock_read=600)

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.request(
                request.method,
                target,
                headers=headers,
                data=await request.read() if request.can_read_body else None,
                allow_redirects=False,
            ) as upstream:
                body = await upstream.read()
                resp_headers = {
                    k: v
                    for k, v in upstream.headers.items()
                    if k.lower() not in _HOP_BY_HOP
                }
                return web.Response(
                    status=upstream.status,
                    headers=resp_headers,
                    body=body,
                )
    except aiohttp.ClientConnectorError:
        return web.json_response(
            {
                "error": "ComfyUI 算力节点未启动或无法连接",
                "worker_url": load_settings().comfy_worker_url,
            },
            status=503,
        )
    except Exception as exc:
        logger.exception("proxy error %s: %s", path, exc)
        return web.json_response({"error": str(exc)}, status=502)


async def _proxy_websocket(request: web.Request) -> web.WebSocketResponse:
    ws_client = web.WebSocketResponse()
    await ws_client.prepare(request)

    comfy_user = _resolve_studio_user_from_request(request)
    headers = _forward_headers(request, comfy_user if comfy_user else None)
    target = _worker_ws_url(request.path_qs)

    try:
        timeout = aiohttp.ClientTimeout(total=None, sock_connect=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.ws_connect(target, headers=headers) as ws_upstream:

                async def client_to_upstream() -> None:
                    async for msg in ws_client:
                        if msg.type == WSMsgType.TEXT:
                            await ws_upstream.send_str(msg.data)
                        elif msg.type == WSMsgType.BINARY:
                            await ws_upstream.send_bytes(msg.data)
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                            break

                async def upstream_to_client() -> None:
                    async for msg in ws_upstream:
                        if msg.type == WSMsgType.TEXT:
                            await ws_client.send_str(msg.data)
                        elif msg.type == WSMsgType.BINARY:
                            await ws_client.send_bytes(msg.data)
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.ERROR):
                            break

                await asyncio.gather(client_to_upstream(), upstream_to_client())
    except aiohttp.ClientConnectorError:
        await ws_client.send_json(
            {"type": "error", "message": "ComfyUI 算力节点未启动或无法连接"}
        )
    except Exception as exc:
        logger.debug("websocket proxy closed: %s", exc)
    finally:
        if not ws_client.closed:
            await ws_client.close()
    return ws_client


async def proxy_comfy_request(request: web.Request) -> web.StreamResponse:
    """代理到 ComfyUI（用于 /?rh_iframe_editor=1 等画布入口）。"""
    return await _proxy_http(request, force=True)


async def _proxy_http_dispatcher(request: web.Request) -> web.StreamResponse:
    if request.path.startswith("/ws"):
        return await _proxy_websocket(request)
    return await _proxy_http(request)


def register_proxy_routes(app: web.Application) -> None:
    app.router.add_get("/ws", _proxy_websocket)
    app.router.add_get("/ws/{tail:.*}", _proxy_websocket)
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"):
        app.router.add_route(method, "/{proxy_path:.*}", _proxy_http_dispatcher)
