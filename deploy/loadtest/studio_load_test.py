#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
灵影创作工坊 API 压力测试（独立包，仅需 Python 3.8+，无第三方依赖）

每台测试机运行一次，模拟用户提交文生图任务，记录「提交 → 生成完成」耗时。
结果 CSV 保存在本目录 results/ 下。
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = SCRIPT_DIR / "config.txt"

PROMPT_SUBJECTS = [
    "赛博朋克城市", "古风少女", "未来机甲", "森林精灵", "海边日落",
    "蒸汽朋克机械鸟", "雪山小屋", "水下宫殿", "沙漠商队", "星空下的猫",
]
PROMPT_STYLES = [
    "电影感光影", "水彩插画", "超写实摄影", "二次元动漫", "油画质感",
]
PROMPT_DETAILS = [
    "细节丰富", "8k 高清", "广角镜头", "浅景深", "体积光",
]


def default_user_id() -> str:
    host = socket.gethostname().split(".")[0] or "user"
    return f"{host}-{uuid.uuid4().hex[:6]}"


def random_prompt() -> str:
    return (
        f"{random.choice(PROMPT_SUBJECTS)}，"
        f"{random.choice(PROMPT_STYLES)}，"
        f"{random.choice(PROMPT_DETAILS)}，"
        f"seed-{random.randint(1000, 999999)}"
    )


def load_config_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip().upper()] = value.strip()
    return values


def request_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: float = 120.0,
    headers: dict[str, str] | None = None,
) -> Any:
    data = None
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req_headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if not body.strip():
                return {}
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(detail)
            message = parsed.get("error") or parsed.get("message") or detail
        except Exception:
            message = detail or str(exc)
        raise RuntimeError(f"HTTP {exc.code}: {message}") from exc


def resolve_comfy_user_id(base_url: str, username: str, comfy_user: str) -> str:
    if comfy_user:
        return comfy_user
    username = username.strip()
    if not username:
        return "default"
    data = request_json(f"{base_url.rstrip('/')}/users", timeout=30.0)
    users = data.get("users") if isinstance(data, dict) else None
    if not isinstance(users, dict):
        return username
    for user_id, display in users.items():
        if str(display) == username or str(user_id) == username:
            return str(user_id)
    raise RuntimeError(f"找不到用户 {username!r}，请检查 config.txt 中的 USERNAME 或填写 COMFY_USER")


def list_apps(base_url: str) -> list[dict[str, Any]]:
    data = request_json(f"{base_url.rstrip('/')}/rh/api/apps?refresh=1")
    apps = data.get("apps")
    return apps if isinstance(apps, list) else []


def pick_app(apps: list[dict[str, Any]], app_id: str | None, mode: str | None, name_contains: str | None) -> dict[str, Any]:
    if app_id:
        for app in apps:
            if str(app.get("id", "")) == app_id:
                return app
        raise RuntimeError(f"找不到 app_id={app_id!r}，请检查 /rh/api/apps")

    filtered = apps
    if mode:
        filtered = [app for app in filtered if mode in (app.get("studio_modes") or [])]
    if name_contains:
        needle = name_contains.lower()
        filtered = [app for app in filtered if needle in str(app.get("name", "")).lower()]
    if not filtered:
        raise RuntimeError("没有匹配的应用，请在 config.txt 中设置 APP_ID")
    return filtered[0]


def poll_result(base_url: str, prompt_id: str, *, timeout_sec: float, interval_sec: float, headers: dict[str, str]) -> tuple[str, dict[str, Any]]:
    deadline = time.time() + timeout_sec
    last: dict[str, Any] = {}
    while time.time() < deadline:
        last = request_json(
            f"{base_url.rstrip('/')}/rh/api/studio/result?prompt_id={urllib.parse.quote(prompt_id)}",
            timeout=min(30.0, interval_sec + 10.0),
            headers=headers,
        )
        completed = bool(last.get("completed"))
        media_count = int(last.get("media_count") or 0)
        status = str(last.get("status") or "").lower()
        if completed and media_count > 0:
            return "completed", last
        if completed and media_count == 0 and status not in ("", "success"):
            return "completed_no_media", last
        if status in {"error", "failed", "cancelled"}:
            return status, last
        time.sleep(interval_sec)
    return "timeout", last


@dataclass
class TaskResult:
    user_id: str
    comfy_user_id: str
    task_index: int
    app_id: str
    app_name: str
    prompt_id: str
    prompt: str
    submit_iso: str
    complete_iso: str
    duration_sec: float
    status: str
    media_count: int
    error: str


def run_one_task(
    *,
    base_url: str,
    user_id: str,
    comfy_user_id: str,
    task_index: int,
    app: dict[str, Any],
    timeout_sec: float,
    poll_interval_sec: float,
    width: int,
    height: int,
    steps: int,
    api_headers: dict[str, str],
) -> TaskResult:
    app_id = str(app.get("id", ""))
    app_name = str(app.get("name") or app_id)
    prompt = random_prompt()
    client_id = f"loadtest-{user_id}-{task_index}-{uuid.uuid4().hex[:8]}"
    submit_ts = time.time()
    submit_iso = datetime.fromtimestamp(submit_ts).isoformat(timespec="seconds")

    try:
        payload = {
            "app_id": app_id,
            "prompt": prompt,
            "negative_prompt": "",
            "params": {
                "prompt": prompt,
                "text": prompt,
                "positive": prompt,
                "positive_prompt": prompt,
                "width": width,
                "height": height,
                "steps": steps,
                "seed": random.randint(1, 2_147_483_647),
                "mode": "t2i",
            },
            "client_id": client_id,
            "user_id": comfy_user_id,
            "wait": False,
        }
        queued = request_json(
            f"{base_url.rstrip('/')}/rh/api/studio/run-local",
            method="POST",
            payload=payload,
            timeout=60.0,
            headers=api_headers,
        )
        prompt_id = str(queued.get("prompt_id") or "").strip()
        if not prompt_id:
            raise RuntimeError(f"提交失败: {queued}")

        status, result = poll_result(
            base_url,
            prompt_id,
            timeout_sec=timeout_sec,
            interval_sec=poll_interval_sec,
            headers=api_headers,
        )
        complete_ts = time.time()
        return TaskResult(
            user_id=user_id,
            comfy_user_id=comfy_user_id,
            task_index=task_index,
            app_id=app_id,
            app_name=app_name,
            prompt_id=prompt_id,
            prompt=prompt,
            submit_iso=submit_iso,
            complete_iso=datetime.fromtimestamp(complete_ts).isoformat(timespec="seconds"),
            duration_sec=round(complete_ts - submit_ts, 3),
            status=status,
            media_count=int(result.get("media_count") or 0),
            error="" if status == "completed" else json.dumps(result, ensure_ascii=False)[:500],
        )
    except Exception as exc:
        complete_ts = time.time()
        return TaskResult(
            user_id=user_id,
            comfy_user_id=comfy_user_id,
            task_index=task_index,
            app_id=app_id,
            app_name=app_name,
            prompt_id="",
            prompt=prompt,
            submit_iso=submit_iso,
            complete_iso=datetime.fromtimestamp(complete_ts).isoformat(timespec="seconds"),
            duration_sec=round(complete_ts - submit_ts, 3),
            status="error",
            media_count=0,
            error=str(exc),
        )


def write_csv(path: Path, rows: list[TaskResult]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(asdict(rows[0]).keys()) if rows else [
        "user_id", "comfy_user_id", "task_index", "app_id", "app_name", "prompt_id", "prompt",
        "submit_iso", "complete_iso", "duration_sec", "status", "media_count", "error",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def print_summary(rows: list[TaskResult]) -> None:
    ok = [r for r in rows if r.status == "completed"]
    print("\n========== 压测汇总 ==========")
    print(f"总任务数: {len(rows)}")
    print(f"成功: {len(ok)}")
    print(f"失败/超时: {len(rows) - len(ok)}")
    if ok:
        durations = sorted(r.duration_sec for r in ok)
        avg = sum(durations) / len(durations)
        p50 = durations[len(durations) // 2]
        p95 = durations[max(0, int(len(durations) * 0.95) - 1)]
        print(f"成功任务耗时(秒) — 最小: {durations[0]:.1f}, 平均: {avg:.1f}, P50: {p50:.1f}, P95: {p95:.1f}, 最大: {durations[-1]:.1f}")


def build_arg_parser(defaults: dict[str, str]) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="灵影 studio API 压力测试（独立包）")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="配置文件路径，默认 config.txt")
    parser.add_argument("--base-url", default=defaults.get("BASE_URL", "http://127.0.0.1:8188"))
    parser.add_argument("--user-id", default=defaults.get("USER_ID") or default_user_id(), help="本机测试标识，建议每台电脑不同")
    parser.add_argument("--username", default=defaults.get("USERNAME", ""), help="服务器登录用户名，如 paj")
    parser.add_argument("--comfy-user", default=defaults.get("COMFY_USER", ""), help="ComfyUI 用户 ID（可选，不填则按 USERNAME 查找）")
    parser.add_argument("--app-id", default=defaults.get("APP_ID", ""))
    parser.add_argument("--mode", default=defaults.get("MODE", "t2i"))
    parser.add_argument("--name-contains", default=defaults.get("NAME_CONTAINS", "文生图"))
    parser.add_argument("--count", type=int, default=int(defaults.get("COUNT", "10") or 10))
    parser.add_argument("--concurrency", type=int, default=int(defaults.get("CONCURRENCY", "1") or 1))
    parser.add_argument("--interval", type=float, default=float(defaults.get("INTERVAL", "0") or 0))
    parser.add_argument("--timeout", type=float, default=float(defaults.get("TIMEOUT", "600") or 600))
    parser.add_argument("--poll-interval", type=float, default=float(defaults.get("POLL_INTERVAL", "2") or 2))
    parser.add_argument("--width", type=int, default=int(defaults.get("WIDTH", "1024") or 1024))
    parser.add_argument("--height", type=int, default=int(defaults.get("HEIGHT", "1024") or 1024))
    parser.add_argument("--steps", type=int, default=int(defaults.get("STEPS", "20") or 20))
    parser.add_argument("--output", default=defaults.get("OUTPUT", ""))
    return parser


def main() -> int:
    pre_cfg = load_config_file(DEFAULT_CONFIG)
    parser = build_arg_parser(pre_cfg)
    args = parser.parse_args()

    cfg_path = Path(args.config)
    if cfg_path.is_file() and cfg_path != DEFAULT_CONFIG:
        pre_cfg.update(load_config_file(cfg_path))
        parser = build_arg_parser(pre_cfg)
        args = parser.parse_args()

    base_url = str(args.base_url).rstrip("/")
    user_id = str(args.user_id).strip() or default_user_id()

    print(f"[{user_id}] 连接 {base_url} ...")
    try:
        comfy_user_id = resolve_comfy_user_id(base_url, str(args.username), str(args.comfy_user))
    except Exception as exc:
        print(f"错误: {exc}")
        return 2

    api_headers = {"comfy-user": comfy_user_id}
    print(f"[{user_id}] ComfyUI 用户: {comfy_user_id}")

    try:
        apps = list_apps(base_url)
        app = pick_app(
            apps,
            args.app_id or None,
            args.mode or None,
            args.name_contains or None,
        )
    except Exception as exc:
        print(f"错误: {exc}")
        return 2

    print(f"[{user_id}] 使用应用: {app.get('name')} ({app.get('id')})")
    print(f"[{user_id}] 计划任务: {args.count}，并发: {args.concurrency}")

    results: list[TaskResult] = []
    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        futures = []
        for i in range(1, args.count + 1):
            if args.interval > 0 and i > 1:
                time.sleep(args.interval)
            futures.append(
                pool.submit(
                    run_one_task,
                    base_url=base_url,
                    user_id=user_id,
                    comfy_user_id=comfy_user_id,
                    task_index=i,
                    app=app,
                    timeout_sec=args.timeout,
                    poll_interval_sec=args.poll_interval,
                    width=args.width,
                    height=args.height,
                    steps=args.steps,
                    api_headers=api_headers,
                )
            )
        for fut in as_completed(futures):
            row = fut.result()
            results.append(row)
            print(
                f"[{user_id}] #{row.task_index:03d} {row.status:16s} "
                f"{row.duration_sec:7.1f}s  prompt_id={row.prompt_id or '-'}"
            )

    results.sort(key=lambda r: r.task_index)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_user = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in user_id)
    output = Path(args.output) if args.output else SCRIPT_DIR / "results" / f"loadtest_{safe_user}_{ts}.csv"
    write_csv(output, results)
    print_summary(results)
    print(f"\n结果已保存: {output}")
    return 0 if all(r.status == "completed" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
