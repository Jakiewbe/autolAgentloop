#!/usr/bin/env python3
"""按当前 app/ 工作区重算 evidence/source-baseline.json 里的哈希与清单（不改别的字段）。

防的失败方式：改动还在，基线里的哈希却停留在旧版本 —— 文档说的身份与实际材料不符。
只改基线文件本身；不提交、不建分支、不碰 app/ 内容。
用法：python -B tools/checks/refresh_source_baseline.py [--note "为什么重算"]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
BASELINE = ROOT / "evidence" / "source-baseline.json"
CN = timezone(timedelta(hours=8))


def sha_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha_file(p: Path) -> str:
    return sha_bytes(p.read_bytes())


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=APP, capture_output=True, check=True).stdout


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--note", default="")
    args = ap.parse_args()

    base = json.loads(BASELINE.read_text(encoding="utf-8"))
    commit = base["baselineCommit"]
    status = git("status", "--porcelain=v1").decode().splitlines()
    modified = sorted(line[3:] for line in status if line.startswith(" M"))
    untracked = sorted(line[3:] for line in status if line.startswith("??"))
    generated = [p for p in untracked if p == "pnpm-lock.yaml"]
    added = [p for p in untracked if p not in generated]

    hashes = base["contentHashes"]
    hashes["modified"] = [
        {
            "path": p,
            "upstream": sha_bytes(git("show", f"{commit}:{p}")),
            "local": sha_file(APP / p),
        }
        for p in modified
    ]
    hashes["added"] = [{"path": p, "sha256": sha_file(APP / p)} for p in added]
    hashes["license_sha256"] = sha_file(APP / "LICENSE")

    patch = ROOT / base["windowsChangeBundle"]["patch"]
    tar = ROOT / "deploy" / "agent-autoloop-96b6c9c7-win2.tar.gz"
    hashes.setdefault("bundle", {})
    hashes["bundle"]["patch_sha256"] = sha_file(patch)
    hashes["bundle"]["deploy_tarball"] = str(tar.relative_to(ROOT)).replace("\\", "/")
    hashes["bundle"]["deploy_sha256"] = sha_file(tar)

    base["changedFiles"]["modified"] = modified
    base["changedFiles"]["added"] = added
    base["changedFiles"]["generated"] = generated
    base["gitStatus"]["afterWindowsChanges"] = [
        f" M {p}" for p in modified
    ] + [f"?? {p}" for p in untracked]
    base["windowsChangeBundle"]["tar"] = hashes["bundle"]["deploy_tarball"]

    for g in base.get("governanceHashes", []):
        p = ROOT / g["path"]
        if p.exists() and not g.get("volatile"):
            g["sha256"] = sha_file(p)

    base["verifiedAt"] = datetime.now(CN).isoformat(timespec="seconds")
    if args.note:
        base["lastRefreshNote"] = args.note
    BASELINE.write_text(json.dumps(base, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"重算完成：modified={len(modified)} added={len(added)} generated={len(generated)}")
    print(f"patch={hashes['bundle']['patch_sha256'][:12]} tar={hashes['bundle']['deploy_sha256'][:12]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
