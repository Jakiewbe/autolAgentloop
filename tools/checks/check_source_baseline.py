#!/usr/bin/env python3
"""核对 evidence/source-baseline.json 与当前 app/ 工作区。

防的失败方式：
1. 基线说「固定在某个上游提交」，但工作区 HEAD 已经变了 —— 改动来源说不清。
2. 改动文件被悄悄替换或回退，文档里的哈希与实物不符。
3. 上游 blob 被本地内容顶替 —— 等于拿本地文件冒充上游基线。
4. 夹带基线里没有的改动。
5. 任务书、GOAL 这类治理文件被顺手改掉。

只读：不写文件、不提交、不建分支。退出码 0 全过、1 有任一不符。
用法：python -B tools/checks/check_source_baseline.py
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
BASELINE = ROOT / "evidence" / "source-baseline.json"
rows: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    rows.append((name, ok, detail))


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def sha256_file(p: Path) -> str:
    return sha256_bytes(p.read_bytes())


def expand_dirs(entries: list[str]) -> list[str]:
    """git 把新目录报成一条（末尾带 /），这里展开成逐个文件，跟基线里记录的粒度一致。"""
    out: list[str] = []
    for entry in entries:
        target = APP / entry.rstrip("/")
        if target.is_dir():
            out.extend(str(f.relative_to(APP)).replace("\\", "/") for f in sorted(target.rglob("*")) if f.is_file())
        else:
            out.append(entry)
    return sorted(out)


def git(*args: str) -> bytes:
    out = subprocess.run(["git", *args], cwd=APP, capture_output=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.decode("utf-8", "replace").strip())
    return out.stdout


def main() -> int:
    if not BASELINE.exists():
        print(f"缺基线文件：{BASELINE}")
        return 1
    base = json.loads(BASELINE.read_text(encoding="utf-8"))
    commit = base["baselineCommit"]

    url = git("remote", "get-url", "origin").decode().strip()
    check("origin 是记录的上游", url.rstrip("/").removesuffix(".git") == base["upstream"].rstrip("/").removesuffix(".git"), url)
    head = git("rev-parse", "HEAD").decode().strip()
    check("HEAD 等于基线提交", head == commit, head[:12])
    branch = git("rev-parse", "--abbrev-ref", "HEAD").decode().strip()
    check("仍在 detached HEAD（没建分支）", branch == "HEAD", branch)

    lic = APP / "LICENSE"
    want_lic = base["contentHashes"]["license_sha256"]
    check("许可证文件哈希", lic.exists() and sha256_file(lic) == want_lic)

    for item in base["contentHashes"]["modified"]:
        p = APP / item["path"]
        got = sha256_file(p) if p.exists() else "<missing>"
        check(f"本地 {item['path']}", got == item["local"], got[:12])
        blob = sha256_bytes(git("show", f"{commit}:{item['path']}"))
        check(f"上游 {item['path']}", blob == item["upstream"], blob[:12])

    for item in base["contentHashes"]["added"]:
        p = APP / item["path"]
        got = sha256_file(p) if p.exists() else "<missing>"
        check(f"新增 {item['path']}", got == item["sha256"], got[:12])

    bundle = base["contentHashes"]["bundle"]
    patch = ROOT / base["windowsChangeBundle"]["patch"]
    check("补丁哈希", patch.exists() and sha256_file(patch) == bundle["patch_sha256"])
    tar = ROOT / bundle["deploy_tarball"]
    check("部署包哈希", tar.exists() and sha256_file(tar) == bundle["deploy_sha256"])

    status = git("status", "--porcelain=v1").decode().splitlines()
    modified = sorted(line[3:] for line in status if line.startswith(" M"))
    untracked = expand_dirs(sorted(line[3:] for line in status if line.startswith("??")))
    check("已改文件集合一致", modified == sorted(base["changedFiles"]["modified"]), ",".join(modified))
    expect_untracked = sorted(base["changedFiles"]["added"] + base["changedFiles"]["generated"])
    check("未跟踪文件集合一致", untracked == expect_untracked, ",".join(untracked))

    for g in base.get("governanceHashes", []):
        p = ROOT / g["path"]
        if not p.exists():
            check(f"治理 {g['path']}", False, "缺文件")
            continue
        ok = sha256_file(p) == g["sha256"]
        if g.get("volatile"):
            rows.append((f"治理 {g['path']}（易变，仅报告）", True, "已变化，按约定不算失败" if not ok else "未变"))
            continue
        check(f"治理 {g['path']}", ok)

    width = max(len(n) for n, _, _ in rows)
    for name, ok, detail in rows:
        print(f"{'PASS' if ok else 'FAIL'}  {name.ljust(width)}  {detail}")
    bad = [n for n, ok, _ in rows if not ok]
    print(f"\n共 {len(rows)} 项，FAIL={len(bad)}")
    if bad:
        print("不符合项：" + "；".join(bad))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
