"""灵影登录 API（网关本地）。"""

from __future__ import annotations

from aiohttp import web

from . import auth

routes = web.RouteTableDef()


def _session_token_from_request(request: web.Request) -> str:
    return str(
        request.headers.get("rh-studio-session")
        or request.headers.get("Rh-Studio-Session")
        or ""
    ).strip()


def _resolve_studio_user_from_request(request: web.Request) -> str | None:
    token = _session_token_from_request(request)
    if token:
        user_id = auth.resolve_session(token)
        if user_id:
            return user_id
        if auth.is_multi_user_enabled():
            return None

    if auth.is_multi_user_enabled():
        return None

    user_id = request.headers.get("Comfy-user") or request.headers.get("comfy-user") or ""
    return str(user_id).strip() or "default"


@routes.get("/users")
async def get_users(_request: web.Request) -> web.Response:
    users = auth.get_all_users()
    if users:
        return web.json_response({"storage": "server", "users": users})
    return web.json_response({"storage": "server", "migrated": False})


@routes.post("/users")
async def post_users(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as exc:
        return web.json_response({"error": f"Invalid JSON: {exc}"}, status=400)
    if not isinstance(body, dict):
        return web.json_response({"error": "Body must be a JSON object"}, status=400)
    username = str(body.get("username", "")).strip()
    if not username:
        return web.json_response({"error": "username not provided"}, status=400)
    users = auth.get_all_users()
    if username in users.values():
        return web.json_response({"error": "Duplicate username."}, status=400)
    try:
        user_id = auth.add_comfy_user(username)
    except ValueError as exc:
        return web.json_response({"error": str(exc)}, status=400)
    return web.json_response(user_id)


@routes.post("/rh/api/studio/auth/login")
async def studio_auth_login(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception as exc:
        return web.json_response({"error": f"Invalid JSON: {exc}"}, status=400)
    if not isinstance(payload, dict):
        return web.json_response({"error": "Body must be a JSON object"}, status=400)

    user_id = str(payload.get("user_id", "")).strip()
    password = str(payload.get("password", ""))
    if not user_id:
        return web.json_response({"error": "请选择用户"}, status=400)

    ok, message, first_time, session_token = auth.login(user_id, password)
    if not ok:
        return web.json_response({"error": message}, status=401)
    return web.json_response(
        {
            "ok": True,
            "user_id": user_id,
            "session_token": session_token,
            "first_time_setup": first_time,
        }
    )


@routes.get("/rh/api/studio/auth/me")
async def studio_auth_me(request: web.Request) -> web.Response:
    studio_user_id = _resolve_studio_user_from_request(request)
    if studio_user_id is None:
        return web.json_response({"error": "登录已失效，请重新登录"}, status=401)
    display_name = auth.get_user_display_name(studio_user_id)
    return web.json_response(
        {
            "ok": True,
            "user_id": studio_user_id,
            "display_name": display_name,
            "multi_user": auth.is_multi_user_enabled(),
        }
    )


@routes.post("/rh/api/studio/auth/logout")
async def studio_auth_logout(request: web.Request) -> web.Response:
    token = _session_token_from_request(request)
    if token:
        auth.revoke_session(token)
    return web.json_response({"ok": True})


@routes.post("/rh/api/studio/auth/register")
async def studio_auth_register(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception as exc:
        return web.json_response({"error": f"Invalid JSON: {exc}"}, status=400)
    if not isinstance(payload, dict):
        return web.json_response({"error": "Body must be a JSON object"}, status=400)

    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    user_id, session_token, err = auth.register(username, password)
    if err:
        status = 400 if err != "用户名已存在" else 409
        return web.json_response({"error": err}, status=status)
    return web.json_response({"ok": True, "user_id": user_id, "session_token": session_token})


def register_auth_routes(app: web.Application) -> None:
    app.add_routes(routes)
