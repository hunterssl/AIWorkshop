"""灵影工坊网关入口。"""

from __future__ import annotations

import logging

from aiohttp import web

from .apps import register_apps_routes
from .auth_routes import register_auth_routes
from .config import load_settings
from .covers import register_cover_routes
from .health import register_health_routes
from .portal_routes import register_portal_routes
from .proxy import register_proxy_routes
from .static_routes import register_static_routes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("lingying")


def create_app() -> web.Application:
    app = web.Application(client_max_size=100 * 1024 * 1024)
    register_static_routes(app)
    register_portal_routes(app)
    register_auth_routes(app)
    register_apps_routes(app)
    register_cover_routes(app)
    register_health_routes(app)
    register_proxy_routes(app)
    return app


def main() -> None:
    settings = load_settings()
    logger.info(
        "灵影网关启动 %s:%s | UI=%s | ComfyUI=%s | user_data=%s",
        settings.host,
        settings.port,
        settings.studio_ui_dir,
        settings.comfy_worker_url,
        settings.user_data_dir,
    )
    app = create_app()
    web.run_app(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
