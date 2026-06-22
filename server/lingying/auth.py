"""灵影登录（独立进程版，数据目录可配置）。"""

from __future__ import annotations

import hashlib
import json
import re
import secrets
import time
import uuid
from pathlib import Path

from .config import load_settings

PBKDF2_ITERATIONS = 100_000
MIN_PASSWORD_LENGTH = 6
SESSION_TTL_SECONDS = 24 * 60 * 60
SYSTEM_USER_PREFIX = "system_"

_sessions: dict[str, tuple[str, float]] = {}
_sessions_loaded = False


def _user_dir() -> Path:
    path = load_settings().user_data_dir
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sessions_file_path() -> Path:
    return _user_dir() / "studio_sessions.json"


def _auth_file_path() -> Path:
    return _user_dir() / "studio_auth.json"


def _users_file_path() -> Path:
    return _user_dir() / "users.json"


def _persist_sessions() -> None:
    payload = {token: [user_id, expires_at] for token, (user_id, expires_at) in _sessions.items()}
    _sessions_file_path().write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_sessions_from_disk() -> None:
    global _sessions_loaded
    if _sessions_loaded:
        return
    _sessions_loaded = True
    path = _sessions_file_path()
    if not path.is_file():
        return
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(raw, dict):
        return
    users = _load_users()
    now = time.time()
    for token, record in raw.items():
        if not isinstance(record, (list, tuple)) or len(record) != 2:
            continue
        user_id = str(record[0] or "").strip()
        try:
            expires_at = float(record[1])
        except (TypeError, ValueError):
            continue
        if expires_at <= now or user_id not in users:
            continue
        _sessions[str(token)] = (user_id, expires_at)
    _persist_sessions()


def _load_auth() -> dict[str, dict[str, str]]:
    path = _auth_file_path()
    if not path.is_file():
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def _save_auth(data: dict[str, dict[str, str]]) -> None:
    _auth_file_path().write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_users() -> dict[str, str]:
    path = _users_file_path()
    if not path.is_file():
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def _save_users(users: dict[str, str]) -> None:
    _users_file_path().write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")


def is_multi_user_enabled() -> bool:
    return bool(_load_users())


def get_all_users() -> dict[str, str]:
    return dict(_load_users())


def get_user_display_name(user_id: str) -> str:
    user_id = str(user_id or "").strip()
    return _load_users().get(user_id, user_id or "default")


def create_session(user_id: str) -> str:
    _load_sessions_from_disk()
    user_id = str(user_id or "").strip()
    token = secrets.token_urlsafe(32)
    _sessions[token] = (user_id, time.time() + SESSION_TTL_SECONDS)
    _persist_sessions()
    return token


def resolve_session(token: str) -> str | None:
    _load_sessions_from_disk()
    token = str(token or "").strip()
    if not token:
        return None
    record = _sessions.get(token)
    if not record:
        return None
    user_id, expires_at = record
    if time.time() > expires_at:
        _sessions.pop(token, None)
        _persist_sessions()
        return None
    users = _load_users()
    if user_id not in users:
        _sessions.pop(token, None)
        _persist_sessions()
        return None
    return user_id


def revoke_session(token: str) -> None:
    _load_sessions_from_disk()
    token = str(token or "").strip()
    if _sessions.pop(token, None) is not None:
        _persist_sessions()


def hash_password(password: str, salt: bytes | None = None) -> dict[str, str]:
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return {"salt": salt.hex(), "hash": digest.hex()}


def verify_password(password: str, record: dict[str, str]) -> bool:
    try:
        salt = bytes.fromhex(record["salt"])
        expected = record["hash"]
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS).hex()
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


def validate_password(password: str) -> str | None:
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        return f"密码至少 {MIN_PASSWORD_LENGTH} 位"
    return None


def add_comfy_user(name: str) -> str:
    name = name.strip()
    if not name:
        raise ValueError("username not provided")
    if name.startswith(SYSTEM_USER_PREFIX):
        raise ValueError("System User prefix not allowed")
    user_id = re.sub("[^a-zA-Z0-9-_]+", "-", name)
    if user_id.startswith(SYSTEM_USER_PREFIX):
        raise ValueError("System User prefix not allowed")
    user_id = user_id + "_" + str(uuid.uuid4())

    users = _load_users()
    if name in users.values():
        raise ValueError("Duplicate username.")

    users[user_id] = name
    _save_users(users)
    return user_id


def set_user_password(user_id: str, password: str) -> None:
    auth = _load_auth()
    auth[user_id] = hash_password(password)
    _save_auth(auth)


def login(user_id: str, password: str) -> tuple[bool, str, bool, str | None]:
    user_id = str(user_id or "").strip()
    users = _load_users()
    if user_id not in users:
        return False, "用户不存在", False, None

    err = validate_password(password)
    if err:
        return False, err, False, None

    auth = _load_auth()
    if user_id not in auth:
        set_user_password(user_id, password)
        return True, "首次登录，密码已设置", True, create_session(user_id)

    if verify_password(password, auth[user_id]):
        return True, "ok", False, create_session(user_id)
    return False, "密码错误", False, None


def register(username: str, password: str) -> tuple[str | None, str | None, str | None]:
    username = str(username or "").strip()
    if not username:
        return None, None, "请输入用户名"

    users = _load_users()
    if username in users.values():
        return None, None, "用户名已存在"

    err = validate_password(password)
    if err:
        return None, None, err

    try:
        user_id = add_comfy_user(username)
    except ValueError as exc:
        return None, None, str(exc)

    set_user_password(user_id, password)
    return user_id, create_session(user_id), None
