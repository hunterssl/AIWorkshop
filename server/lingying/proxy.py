"""反向代理到 ComfyUI 算力节点。"""

from __future__ import annotations

import asyncio
import logging

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
    "/rh/api/apps",
)


def _should_proxy(path: str) -> bool:
    if any(path.startswith(p) for p in _LOCAL_RH_API_PREFIXES):
        return False
    return any(path.startswith(p) for p in _PROXY_PREFIXES)


def _forward_headers(request: web.Request, comfy_user: str | None) -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in request.headers.items():
        lower = key.lower()
        if lower in _HOP_BY_HOP:
            continue
        headers[key] = value
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


async def _proxy_http(request: web.Request) -> web.Response:
    path = request.path
    if not _should_proxy(path):
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


async def _proxy_http_dispatcher(request: web.Request) -> web.StreamResponse:
    if request.path.startswith("/ws"):
        return await _proxy_websocket(request)
    return await _proxy_http(request)


def register_proxy_routes(app: web.Application) -> None:
    app.router.add_get("/ws", _proxy_websocket)
    app.router.add_get("/ws/{tail:.*}", _proxy_websocket)
    for method in ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"):
        app.router.add_route(method, "/{proxy_path:.*}", _proxy_http_dispatcher)
