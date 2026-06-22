"""健康检查与画布配置。"""

from __future__ import annotations

import logging

import aiohttp
from aiohttp import web

from .config import load_settings

logger = logging.getLogger("lingying.health")
routes = web.RouteTableDef()


@routes.get("/rh/api/health")
async def health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "lingying-gateway"})


@routes.get("/rh/api/comfy/status")
async def comfy_status(_request: web.Request) -> web.Response:
    settings = load_settings()
    url = f"{settings.comfy_worker_base}/system_stats"
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return web.json_response(
                        {
                            "ok": True,
                            "online": True,
                            "worker_url": settings.comfy_worker_url,
                            "system_stats": data,
                        }
                    )
                body = await resp.text()
                return web.json_response(
                    {
                        "ok": False,
                        "online": False,
                        "worker_url": settings.comfy_worker_url,
                        "error": f"HTTP {resp.status}: {body[:200]}",
                    },
                    status=503,
                )
    except Exception as exc:
        logger.debug("ComfyUI probe failed: %s", exc)
        return web.json_response(
            {
                "ok": False,
                "online": False,
                "worker_url": settings.comfy_worker_url,
                "error": str(exc),
            },
            status=503,
        )


@routes.get("/rh/api/canvas2/config")
async def canvas2_config(request: web.Request) -> web.Response:
    host = request.host or "127.0.0.1"
    scheme = request.scheme or "http"
    same_origin = f"{scheme}://{host}"
    return web.json_response(
        {
            "image_models": ["gpt-image-1", "qwen-image"],
            "chat_models": ["gpt-4o-mini"],
            "video_models": ["kling-v1"],
            "ms_chat_models": [],
            "comfy_instances": [same_origin],
            "api_providers": [],
        }
    )


def register_health_routes(app: web.Application) -> None:
    app.add_routes(routes)
