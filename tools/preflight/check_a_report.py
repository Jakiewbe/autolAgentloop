#!/usr/bin/env python3
"""T2 检查：evidence/preflight/A.md 的结构、证据引用与凭据泄漏校验。

用法: python -B tools/preflight/check_a_report.py [report_path]
退出码 0 表示全部断言通过；每个断言打印 PASS/FAIL。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BT = chr(96)

REQUIRED_SECTIONS = [
    ("治理状态", "治理状态核对"),
    ("系统身份", "系统身份与硬件"),
    ("工具链", "工具链与绝对入口"),
    ("DSH 入口版本", "DSH 桌面入口与自动化入口是否同版本"),
    ("后台上下文", "无交互/后台上下文"),
    ("模型通道", "模型通道盘点"),
    ("小任务实测", "小任务实测"),
    ("项目盘点", "候选业务项目盘点"),
    ("常驻条件", "常驻条件"),
    ("通道启动方式", "两条初始执行通道的无交互启动方式"),
    ("日志索引", "原始日志索引"),
    ("缺口清单", "未验证 / 缺口 / 风险清单"),
]

LEVEL_TOKENS = ("已实测", "仅文件确认", "未验证")

SECRET_PATTERNS = [
    (r"sk-[A-Za-z0-9_\-]{20,}", "疑似 API key 明文"),
    (r"gh[pousr]_[A-Za-z0-9]{20,}", "疑似 GitHub token 明文"),
    (r"(?i)authorization:\s*bearer\s+\S{20,}", "疑似 bearer token 明文"),
    (r"(?i)(api_?key|authtoken|password|passwd)\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{16,}", "疑似凭据键值明文"),
]

failures = []


def check(ok, label, detail=""):
    print(("PASS " if ok else "FAIL ") + label + ((" :: " + detail) if detail and not ok else ""))
    if not ok:
        failures.append(label + (" :: " + detail if detail else ""))


def main():
    rel = sys.argv[1] if len(sys.argv) > 1 else "evidence/preflight/A.md"
    path = (ROOT / rel).resolve()
    check(path.is_file(), "报告文件存在", str(path))
    if not path.is_file():
        return 1
    text = path.read_text(encoding="utf-8")
    check(len(text) > 4000, "报告内容非平凡（>4000 字符）", "len=%d" % len(text))

    headings = re.findall(r"^##\s+(.+)$", text, re.M)
    for label, frag in REQUIRED_SECTIONS:
        check(any(frag in h for h in headings), "存在小节：" + label, "、".join(headings))

    blocks = re.split(r"^##\s+", text, flags=re.M)[1:]
    missing_level = [b.splitlines()[0].strip() for b in blocks if not any(t in b for t in LEVEL_TOKENS)]
    check(not missing_level, "每个小节都标注验证级别", "；".join(missing_level))

    check(bool(re.search(r"2026-\d{2}-\d{2} \d{2}:\d{2}", text)), "包含采集时间")
    check("DESKTOP-LM7RKI1" in text, "包含本机主机名")

    span = re.compile(BT + "([^" + BT + "\n]+)" + BT)
    known = set()
    for p in (ROOT / "evidence").rglob("*"):
        if p.is_file():
            known.add(p.name)
            known.add(str(p.relative_to(ROOT)).replace(chr(92), "/"))
    refs = set()
    for token in span.findall(text):
        token = token.strip().replace(chr(92), "/")
        if not re.search(r"\.(txt|log|md|json|jsonl|ps1|sh)$", token):
            continue
        # 只校验本仓库内的证据引用；绝对路径、~ 路径、占位符与通用文件名跳过
        if ":" in token or token.startswith("~") or "…" in token or "<" in token:
            continue
        rel = token.lstrip("./")
        if not (rel.startswith("evidence/") or rel.startswith("raw/") or re.match(r"\d{8}-\d{6}", rel.split("/")[-1])):
            continue
        refs.add(token)
    resolved = []
    missing = []
    for ref in sorted(refs):
        if "raw/" in ref:
            tail = ref[ref.index("raw/") + 4:]
            tail = tail.split("/", 1)[1] if tail.startswith("preflight/") is False and "/" in tail else tail
            if (ROOT / "evidence" / "raw" / tail).exists() or (ROOT / "evidence" / "raw" / ref.split("raw/", 1)[1]).exists():
                resolved.append(ref)
            else:
                missing.append(ref)
            continue
        if ref in known or ref.split("/")[-1] in known:
            resolved.append(ref)
        else:
            missing.append(ref)
    check(len(resolved) >= 8, "引用了足够多的原始日志", "resolved=%d" % len(resolved))
    check(not missing, "所有具体文件引用均存在", "；".join(missing))

    leaks = []
    for pattern, label in SECRET_PATTERNS:
        for m in re.finditer(pattern, text):
            if "<REDACTED" in m.group(0):
                continue
            leaks.append(label + " -> " + m.group(0)[:12] + "…")
    check(not leaks, "报告不含凭据明文", "；".join(leaks))

    check("独立验收通过" not in text.replace("不能自行宣布独立验收通过", ""), "未自行宣布独立验收通过")

    print("----")
    print("FAILURES=%d" % len(failures))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())